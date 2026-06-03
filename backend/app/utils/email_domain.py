from app.models.community import Community

# Known institutional domains → community names
# This map auto-seeds communities if they don't exist in DB
KNOWN_DOMAINS = {
    "presidency.edu.in":  "Presidency College Commuters",
    "iimb.ac.in":         "IIM Bangalore Commuters",
    "iisc.ac.in":         "IISc Bangalore Commuters",
    "bmsce.ac.in":        "BMSCE Commuters",
    "rvce.edu.in":        "RVCE Commuters",
    "pesu.pes.edu":       "PES University Commuters",
    "christ.edu.in":      "Christ University Commuters",
    "manipal.edu":        "Manipal University Commuters",
}


def get_community_for_email(email: str):
    """
    Extract domain from email and look up / auto-create a community.
    Returns a Community document or None.
    """
    if "@" not in email:
        return None

    domain = email.split("@")[-1].lower()
    community = Community.objects(email_domain=domain).first()

    if community:
        return community

    # Auto-create if it's a known institutional domain
    if domain in KNOWN_DOMAINS:
        community = Community(
            name=KNOWN_DOMAINS[domain],
            email_domain=domain,
            member_ids=[],
        )
        community.save()
        return community

    return None
