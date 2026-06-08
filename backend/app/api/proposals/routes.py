from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import User
from app.models.channel import Channel
from app.models.space import Space
from app.models.message import Message
from app.models.ride_proposal import RideProposal
from app.models.ride import Ride
from app.extensions import socketio

proposals_bp = Blueprint("proposals", __name__)


def _me():
    return User.objects(id=get_jwt_identity()).first()


def _assert_member(user, proposal):
    if not user.community_id:
        return jsonify({"error": "No community"}), 403
    if str(proposal.community_id.id) != str(user.community_id.id):
        return jsonify({"error": "Access denied"}), 403
    return None


def _assert_organiser(user, proposal):
    if str(proposal.organiser_id.id) != str(user.id):
        return jsonify({"error": "Only the organiser can do this"}), 403
    return None


def _emit(event, proposal, extra=None):
    payload = {"proposal_id": str(proposal.id), **(extra or {})}
    socketio.emit(event, payload, room=f"channel_{str(proposal.channel_id.id)}")


def _system_message(channel, content):
    msg = Message(channel_id=channel, sender_id=None, content=content, message_type="system")
    # system messages have no sender — use a dummy safe save
    msg.sender_id = None
    try:
        msg.save()
    except Exception:
        pass
    socketio.emit("new_message", {
        "id": str(msg.id) if msg.id else "",
        "channel_id": str(channel.id),
        "sender_id": None,
        "sender_name": "System",
        "content": content,
        "message_type": "system",
        "created_at": datetime.utcnow().isoformat(),
        "deleted": False,
    }, room=f"channel_{str(channel.id)}")


# ── Create proposal ────────────────────────────────────────────────────────────

@proposals_bp.route("/", methods=["POST"])
@jwt_required()
def create_proposal():
    user = _me()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    channel_id  = data.get("channel_id")
    destination = data.get("destination")
    proposed_time_str = data.get("proposed_time")

    if not all([channel_id, destination, proposed_time_str]):
        return jsonify({"error": "channel_id, destination, proposed_time required"}), 400

    ch = Channel.objects(id=channel_id).first()
    if not ch:
        return jsonify({"error": "Channel not found"}), 404

    space = Space.objects(id=ch.space_id.id).first()
    if not space or not user.community_id:
        return jsonify({"error": "Access denied"}), 403
    if str(space.community_id.id) != str(user.community_id.id):
        return jsonify({"error": "Access denied"}), 403

    try:
        proposed_time = datetime.fromisoformat(proposed_time_str)
    except ValueError:
        return jsonify({"error": "Invalid proposed_time format (ISO 8601 required)"}), 400

    proposal = RideProposal(
        channel_id=ch,
        community_id=user.community_id,
        organiser_id=user,
        destination=destination,
        proposed_time=proposed_time,
        ride_type=data.get("ride_type", "pooled"),
        women_only=data.get("women_only", False),
        max_participants=data.get("max_participants", 4),
        participants=[],
    )
    proposal.save()

    # Post a ride_proposal message card into the channel
    msg = Message(
        channel_id=ch,
        sender_id=user,
        content=f"{user.name} proposed a group ride to {destination.get('address', 'destination')} at {proposed_time.strftime('%I:%M %p')}",
        message_type="ride_proposal",
        ride_proposal_id=proposal,
    )
    msg.save()

    socketio.emit("new_message", msg.to_json_safe(), room=f"channel_{channel_id}")
    socketio.emit("proposal_created", proposal.to_json_safe(), room=f"channel_{channel_id}")

    return jsonify(proposal.to_json_safe()), 201


# ── Get proposal ───────────────────────────────────────────────────────────────

@proposals_bp.route("/<proposal_id>", methods=["GET"])
@jwt_required()
def get_proposal(proposal_id):
    user = _me()
    proposal = RideProposal.objects(id=proposal_id).first()
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404
    err = _assert_member(user, proposal)
    if err:
        return err
    return jsonify(proposal.to_json_safe()), 200


# ── Join proposal ──────────────────────────────────────────────────────────────

@proposals_bp.route("/<proposal_id>/join", methods=["POST"])
@jwt_required()
def join_proposal(proposal_id):
    user = _me()
    proposal = RideProposal.objects(id=proposal_id).first()
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404
    err = _assert_member(user, proposal)
    if err:
        return err

    if proposal.status != "open":
        return jsonify({"error": "Proposal is no longer open"}), 400

    active = [p for p in proposal.participants if p.get("status") != "kicked"]
    if len(active) >= proposal.max_participants:
        return jsonify({"error": "Proposal is full"}), 400

    if any(p["user_id"] == str(user.id) and p.get("status") != "kicked" for p in proposal.participants):
        return jsonify({"error": "Already joined"}), 409

    data = request.get_json() or {}
    pickup = data.get("pickup")
    if not pickup or not all(k in pickup for k in ["lat", "lng", "address"]):
        return jsonify({"error": "pickup {lat, lng, address} required"}), 400

    participant = {
        "user_id":  str(user.id),
        "name":     user.name,
        "pickup":   pickup,
        "status":   "confirmed",
        "stop_order":      None,
        "individual_fare": None,
    }
    proposal.participants.append(participant)
    proposal.save()

    _emit("proposal_joined", proposal, {"participant": participant})
    _system_message(
        proposal.channel_id,
        f"{user.name} joined the ride proposal.",
    )

    return jsonify({"message": "Joined", "participant": participant}), 200


# ── Leave proposal ─────────────────────────────────────────────────────────────

@proposals_bp.route("/<proposal_id>/leave", methods=["POST"])
@jwt_required()
def leave_proposal(proposal_id):
    user = _me()
    proposal = RideProposal.objects(id=proposal_id).first()
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404

    if proposal.status != "open":
        return jsonify({"error": "Cannot leave after proposal is locked"}), 400

    proposal.participants = [
        p for p in proposal.participants if p["user_id"] != str(user.id)
    ]
    proposal.save()

    _emit("proposal_left", proposal, {"user_id": str(user.id)})
    _system_message(proposal.channel_id, f"{user.name} left the ride proposal.")

    return jsonify({"message": "Left proposal"}), 200


# ── Kick participant ───────────────────────────────────────────────────────────

@proposals_bp.route("/<proposal_id>/kick/<target_user_id>", methods=["POST"])
@jwt_required()
def kick_participant(proposal_id, target_user_id):
    user = _me()
    proposal = RideProposal.objects(id=proposal_id).first()
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404
    err = _assert_organiser(user, proposal)
    if err:
        return err

    if proposal.status != "open":
        return jsonify({"error": "Can only kick while proposal is open"}), 400

    found = False
    for p in proposal.participants:
        if p["user_id"] == target_user_id:
            p["status"] = "kicked"
            found = True
            break

    if not found:
        return jsonify({"error": "Participant not found"}), 404

    proposal.save()

    target = User.objects(id=target_user_id).first()
    _emit("participant_kicked", proposal, {"user_id": target_user_id})
    _system_message(
        proposal.channel_id,
        f"{target.name if target else 'A member'} was removed from the ride proposal by the organiser.",
    )

    return jsonify({"message": "Participant kicked"}), 200


# ── Lock proposal ──────────────────────────────────────────────────────────────

@proposals_bp.route("/<proposal_id>/lock", methods=["POST"])
@jwt_required()
def lock_proposal(proposal_id):
    user = _me()
    proposal = RideProposal.objects(id=proposal_id).first()
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404
    err = _assert_organiser(user, proposal)
    if err:
        return err

    if proposal.status != "open":
        return jsonify({"error": "Proposal is not open"}), 400

    confirmed = [p for p in proposal.participants if p.get("status") == "confirmed"]
    if len(confirmed) < 1:
        return jsonify({"error": "Need at least 1 confirmed participant to lock"}), 400

    try:
        from app.services.group_routing import plan_group_route
        route_plan = plan_group_route(confirmed, proposal.destination, proposal.ride_type)
    except Exception as e:
        return jsonify({"error": f"Route planning failed: {str(e)}"}), 500

    # Write stop_order and individual_fare back into participants list
    fare_map = route_plan["per_passenger_fare"]
    stop_map = {s["user_id"]: s["stop_order"] for s in route_plan["stops"]}
    for p in proposal.participants:
        if p.get("status") == "confirmed":
            p["stop_order"]      = stop_map.get(p["user_id"])
            p["individual_fare"] = fare_map.get(p["user_id"])

    proposal.route_plan = route_plan
    proposal.status     = "locked"
    proposal.locked_at  = datetime.utcnow()
    proposal.save()

    _emit("proposal_locked", proposal, {"route_plan": route_plan})
    _system_message(
        proposal.channel_id,
        f"Route locked. {len(confirmed)} stops planned. Each passenger fare: ₹{list(fare_map.values())[0] if fare_map else '?'}",
    )

    return jsonify(proposal.to_json_safe()), 200


# ── Dispatch proposal ──────────────────────────────────────────────────────────

@proposals_bp.route("/<proposal_id>/dispatch", methods=["POST"])
@jwt_required()
def dispatch_proposal(proposal_id):
    user = _me()
    proposal = RideProposal.objects(id=proposal_id).first()
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404
    err = _assert_organiser(user, proposal)
    if err:
        return err

    if proposal.status != "locked":
        return jsonify({"error": "Proposal must be locked before dispatching"}), 400

    confirmed = [p for p in proposal.participants if p.get("status") == "confirmed"]
    if not confirmed:
        return jsonify({"error": "No confirmed participants"}), 400

    route_plan = proposal.route_plan or {}

    # Build ordered stops for the Ride document
    stops = [
        {
            "user_id":     p["user_id"],
            "name":        p["name"],
            "pickup":      p["pickup"],
            "status":      "pending",
            "picked_up_at": None,
            "stop_order":  p.get("stop_order"),
        }
        for p in sorted(confirmed, key=lambda x: x.get("stop_order") or 0)
    ]

    # Use organiser as the "passenger" for the Ride document
    # First confirmed stop's pickup as the Ride pickup (driver heads there first)
    first_stop = stops[0]["pickup"] if stops else proposal.destination

    from app.utils.carbon import calculate_co2_saved, calculate_green_points
    dist_km   = route_plan.get("total_distance_km", 5.0)
    co2_saved = calculate_co2_saved(dist_km, proposal.ride_type, len(confirmed))
    green_pts = calculate_green_points(proposal.ride_type)

    ride = Ride(
        passenger_id=user,
        driver_id=None,
        pickup=first_stop,
        dropoff=proposal.destination,
        status="searching",
        ride_type=proposal.ride_type,
        women_only=proposal.women_only,
        fare=route_plan.get("total_fare", 0),
        distance_km=dist_km,
        co2_saved=co2_saved,
        green_points_awarded=green_pts,
        is_group_ride=True,
        proposal_id=proposal,
        stops=stops,
        per_passenger_fare=route_plan.get("per_passenger_fare", {}),
        pool_passengers=len(confirmed),
    )
    ride.save()

    proposal.ride_id      = ride
    proposal.status       = "searching"
    proposal.dispatched_at = datetime.utcnow()
    proposal.save()

    socketio.emit("new_ride_available", ride.to_json_safe(), room="drivers")
    _emit("proposal_dispatched", proposal, {"ride_id": str(ride.id)})
    _system_message(
        proposal.channel_id,
        "Ride dispatched! Searching for a driver...",
    )

    return jsonify({"message": "Dispatched", "ride": ride.to_json_safe()}), 200


# ── Cancel proposal ────────────────────────────────────────────────────────────

@proposals_bp.route("/<proposal_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_proposal(proposal_id):
    user = _me()
    proposal = RideProposal.objects(id=proposal_id).first()
    if not proposal:
        return jsonify({"error": "Proposal not found"}), 404
    err = _assert_organiser(user, proposal)
    if err:
        return err

    if proposal.status in ["completed", "cancelled"]:
        return jsonify({"error": f"Already {proposal.status}"}), 400

    proposal.status = "cancelled"
    proposal.save()

    _emit("proposal_cancelled", proposal)
    _system_message(proposal.channel_id, "The ride proposal was cancelled by the organiser.")

    return jsonify({"message": "Cancelled"}), 200
