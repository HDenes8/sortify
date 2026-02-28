# backend entry point; loads environment variables and starts Flask
import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
dotenv_path = os.path.join(basedir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

from website import create_app

app = create_app()

if __name__ == '__main__':
    # Run in production mode on Render, development mode locally
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))