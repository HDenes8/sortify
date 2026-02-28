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
    app.run(debug=True)