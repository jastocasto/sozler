import os
from flask import Flask, jsonify
import gspread
from google.oauth2.service_account import Credentials
from flask_cors import CORS
import json

# Create Flask app
app = Flask(__name__)

# Set up CORS to allow communication between backend and frontend
CORS(app, resources={r"/*": {"origins": "*"}})

# Path where the service account credentials will be temporarily stored
SERVICE_ACCOUNT_FILE = "/tmp/service_account.json"

# Fetch the service account JSON from the environment variable
service_account_json = os.getenv("SERVICE_ACCOUNT_JSON")

if not service_account_json:
    raise RuntimeError("Service account JSON not found in environment variable 'SERVICE_ACCOUNT_JSON'.")

# Write the JSON content to a temporary file
try:
    with open(SERVICE_ACCOUNT_FILE, "w") as f:
        f.write(service_account_json)
except Exception as e:
    raise RuntimeError(f"Failed to write service account file: {e}")

# Authenticate using the service account credentials file
try:
    credentials = Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    )
    client = gspread.authorize(credentials)
except Exception as e:
    raise RuntimeError(f"Failed to authenticate with Google API: {e}")

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
    except gspread.SpreadsheetNotFound:
        return jsonify({"error": "Google Sheet not found. Check the sheet name or permissions."}), 404
    except gspread.WorksheetNotFound:
        return jsonify({"error": "Worksheet not found. Check the worksheet name."}), 404
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500

if __name__ == '__main__':
    # Dynamic port binding for deployment platforms
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
