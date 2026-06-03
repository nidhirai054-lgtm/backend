import requests

# Your backend URL (adjust if different)
BASE_URL = "http://localhost:5000"

# Registration data
register_data = {
    "name": "Ananya Sharma",
    "email": "ananya@google.com",
    "password": "ananya123",
    "role": "passenger",
    "gender": "female"
}

# Register
print("Registering user...")
response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}\n")

if response.status_code == 201:
    print("✅ Registration successful!")
    print("\n=== LOGIN CREDENTIALS ===")
    print(f"Email: {register_data['email']}")
    print(f"Password: {register_data['password']}")
    print("========================\n")
    
    # Auto-login
    login_data = {
        "email": register_data["email"],
        "password": register_data["password"]
    }
    
    print("Logging in...")
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    print(f"Status: {login_response.status_code}")
    
    if login_response.status_code == 200:
        result = login_response.json()
        print("✅ Login successful!")
        print(f"\nAccess Token: {result['access_token'][:50]}...")
    else:
        print(f"❌ Login failed: {login_response.json()}")
else:
    print(f"❌ Registration failed: {response.json()}")
