#!/usr/bin/env python3
"""
Migrate old ride statuses to new status system
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models.ride import Ride

def migrate_statuses():
    app = create_app()
    with app.app_context():
        # Map old statuses to new ones
        status_map = {
            'pending': 'searching',
            'active': 'in_progress'
        }
        
        rides = Ride.objects()
        updated = 0
        
        for ride in rides:
            if ride.status in status_map:
                old_status = ride.status
                new_status = status_map[old_status]
                ride.status = new_status
                ride.save()
                updated += 1
                print(f"✅ Updated ride {ride.id}: {old_status} → {new_status}")
        
        print(f"\n✅ Migration complete! Updated {updated} rides")
        print(f"📊 Total rides in database: {Ride.objects.count()}")

if __name__ == "__main__":
    migrate_statuses()
