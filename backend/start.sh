#!/bin/bash
# Migrate database and run Flask app
flask db upgrade
gunicorn app:app
