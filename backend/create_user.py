import bcrypt
from app import create_app
from app.models.user import User

app = create_app()

with app.app_context():
    # Check if user already exists
    existing_user = User.objects(email="ananya@google.com").first()
    
    if existing_user:
        print("User already exists!")
        print(f"Email: ananya@google.com")
        print(f"Password: ananya123")
        print("\nYou can login now with these credentials.")
    else:
        # Create user directly in database
        hashed = bcrypt.hashpw("ananya123".encode(), bcrypt.gensalt()).decode()
        
        user = User(
            name="Ananya Sharma",
            email="ananya@google.com",
            password_hash=hashed,
            role="passenger",
            gender="female",
            is_active=True
        )
        user.save()
        
        print("✅ User created successfully!")
        print("\n=== LOGIN CREDENTIALS ===")
        print("Email: ananya@google.com")
        print("Password: ananya123")
        print("========================")
