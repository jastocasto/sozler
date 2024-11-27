import os
from flask import Flask, jsonify
import gspread
from google.oauth2.service_account import Credentials
from flask_cors import CORS
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Set up CORS to allow communication between backend and frontend
CORS(app, resources={r"/*": {"origins": "*"}})  # Update origins to "*" for public access if needed

# Load the service account credentials from environment variable
SERVICE_ACCOUNT_CREDENTIALS = os.getenv('GOOGLE_CREDENTIALS')

if not SERVICE_ACCOUNT_CREDENTIALS:
    raise ValueError("Google service account credentials not found. Check the GOOGLE_CREDENTIALS environment variable.")

# Parse the service account credentials JSON string
credentials_dict = json.loads(SERVICE_ACCOUNT_CREDENTIALS)

# Define the necessary Google API scopes
SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]

# Authenticate using the service account credentials
credentials = Credentials.from_service_account_info(credentials_dict, scopes=SCOPES)
client = gspread.authorize(credentials)

# Fetch data from the Google Sheet
@app.route('/data', methods=['GET'])
def get_data():
    try:
        # Open the Google Sheet and worksheet
        sheet = client.open("Söz Xəritəsi").worksheet("newbrand")
        data = sheet.get_all_records()

        # Convert sheet data into the desired structure
        nodes = []
        for row in data:
            nodes.append({
                "kok": row.get("kök", ""),
                "id": row.get("söz", ""),
                "en_word": row.get("word", ""),
                "az_word_type": row.get("növ", ""),
                "en_word_type": row.get("type", ""),
                "azerbaijani_synonyms": row.get("sinonimlər", ""),
                "english_synonyms": row.get("synonyms", ""),
                "azerbaijani_antonyms": row.get("antonimlər", ""),
                "english_antonyms": row.get("antonyms", ""),
                "azerbaijani_variants": row.get("variantlar", ""),
                "english_variants": row.get("variants", ""),
                "azerbaijani_sentences": row.get("cümlələr", ""),
            })

        return jsonify({"nodes": nodes})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Dynamic port binding for deployment platforms
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
