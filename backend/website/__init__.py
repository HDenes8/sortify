from flask import Flask, jsonify, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
import os
from os import path
from flask_login import LoginManager
from datetime import timedelta
from flask_migrate import Migrate
from flask_cors import CORS

# database and migration objects (initialized later)
db = SQLAlchemy()
migrate = Migrate()
DB_NAME = "database.db"

# Function to initialize the application
def create_app():
    app = Flask(__name__, static_folder='static')
    # configuration from environment (fallback to dev values)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'szekret')
    # DATABASE_URL is the standard name used by many hosting providers
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        # Log an explicit warning so deploy logs make it clear why the connection fails.
        app.logger.warning(
            "DATABASE_URL not set; using localhost fallback which will not work in production."
        )
        db_url = 'postgresql://postgres:password@localhost:5432/sortify'
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['REMEMBER_COOKIE_DURATION'] = timedelta(hours=1)
    # cookie settings for cross-site (front-end on different domain)
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'
    app.config['SESSION_COOKIE_SECURE'] = True
    app.config['REMEMBER_COOKIE_SAMESITE'] = 'None'
    app.config['REMEMBER_COOKIE_SECURE'] = True

    UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)    
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER 

    # enable CORS for all routes with credential support (required for session-based auth with cookies)
    # When credentials=True, origins CANNOT be '*'. Must be specific origin(s).
    # Set CORS_ORIGINS environment variable with comma-separated list of approved origins
    # Example: https://sortify-eight.vercel.app,https://localhost:3000
    cors_origins_env = os.environ.get('CORS_ORIGINS', 'https://sortify-eight.vercel.app')
    # Parse comma-separated origins into a list and strip trailing slashes
    cors_origins_list = [origin.strip().rstrip('/') for origin in cors_origins_env.split(',') if origin.strip()]
    print("CORS configured origins:", cors_origins_list)  # debug output
    
    CORS(
        app,
        resources={
            r"/*": {
                "origins": cors_origins_list,
                "supports_credentials": True,  # Enable sending credentials (cookies)
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        }
    )

    db.init_app(app)
    migrate.init_app(app, db)

    from .views import views
    from .auth import auth
    from .views import projects_bp

    app.register_blueprint(views, url_prefix='/')
    app.register_blueprint(auth, url_prefix='/')
    app.register_blueprint(projects_bp)

    from .models import User_profile

    create_database(app)

    # Handlers for login/logout
    login_manager = LoginManager()
    login_manager.login_view = 'auth.login'
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(id):
        return User_profile.query.get(int(id))
    
    @login_manager.unauthorized_handler
    def unauthorized():
        # Check if the request is an API request
        if request.path.startswith('/api/'):
            return jsonify({"error": "Unauthorized"}), 401
        else:
            # Redirect to the login page for non-API requests
            return redirect(url_for('auth.login'))
    
    return app

#PostgreSQL
def create_database(app):
    with app.app_context():
        db.create_all()
    print('Checked/created tables (if missing).')

