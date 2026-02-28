# Projekt Áttekintés

Ez a projekt egy **backendből** (Python Flask) és egy **frontendből** (React) áll. A backend és a frontend Docker segítségével van konténerizálva, hogy egyszerűbb legyen a fejlesztés és a telepítés.

## Előfeltételek

A projekt futtatása előtt győződj meg arról, hogy a következők telepítve vannak:

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/)

## Projekt Struktúra

- **backend/**: A Flask backend alkalmazás.
- **frontend/**: A React frontend alkalmazás.
- **greenlet/**: A `greenlet` könyvtár C fejlécei.
- **Lib/** és **Scripts/**: Python virtuális környezet fájlok.

## A Projekt Futtatása

### Repository Klónozása

1. **Klónozd a repository-t** a Git segítségével:

   ```sh
   git clone https://github.com/HDenes8/react-flusk-testsite-2025.git
   ```

2. **Navigálj a projekt gyökérkönyvtárába**:

   ```sh
   cd react-flusk-testsite-2025
   ```

### Docker Compose használatával

3. **Építsd fel és indítsd el a konténereket** a Docker Compose segítségével:

   ```sh
   docker-compose up --build
   ```

   - A `--build` kapcsoló biztosítja, hogy a konténerek újraépüljenek, ha változások történtek a kódban vagy a függőségekben.

4. **Várj, amíg a konténerek elindulnak**:
   - A Docker Compose letölti a szükséges képeket, felépíti a konténereket, és elindítja a szolgáltatásokat.
   - A terminálban megjelenő naplókból láthatod, hogy a backend és a frontend szolgáltatások sikeresen elindultak.

5. **Az alkalmazás elérése**:
   - A **backend** (Flask API) elérhető itt:  
     `http://localhost:5000`
   - A **frontend** (React app) elérhető itt:  
     `http://localhost:3000`

   Nyisd meg ezeket az URL-eket a böngésződben, hogy ellenőrizd, az alkalmazás fut-e.

6. **A konténerek leállítása**:
   - A konténerek leállításához nyomd meg a `Ctrl+C`-t abban a terminálban, ahol a Docker Compose fut.
   - Ezután tisztítsd meg a konténereket és a hálózatokat az alábbi paranccsal:

     ```sh
     docker-compose down
     ```

7. **A konténerek újraépítése**:
   - Ha változtatsz a kódon, és újra kell építened a konténereket, használd:

     ```sh
     docker-compose up --build
     ```

### Mit várhatsz?

- Ha meglátogatod a `http://localhost:5000` címet:
  - A backend API alapértelmezett válaszát kell látnod (pl. egy JSON üzenetet vagy egy "Welcome" üzenetet, attól függően, hogyan van konfigurálva a Flask alkalmazás).

- Ha meglátogatod a `http://localhost:3000` címet:
  - A React frontend alkalmazásnak kell betöltődnie a böngésződben.

### Hibakeresés

- Ha a konténerek nem indulnak el, nézd meg a naplókat a hibákért:

  ```sh
  docker-compose logs
  ```

- Ha egy adott szolgáltatás (pl. `backend`) hibásodik meg, nézd meg annak naplóit:

  ```sh
  docker-compose logs backend
  ```

- Győződj meg arról, hogy más alkalmazások nem használják az `5000` vagy `3000` portokat. Ha ezek a portok foglaltak, módosítsd a `docker-compose.yml` fájlt más portok használatára.

## Megjegyzések

- Győződj meg arról, hogy a backend és a frontend megfelelően kommunikál egymással. Szükség esetén frissítsd az API URL-eket a frontend kódban.
- A termelési telepítéshez fontold meg egy fordított proxy (pl. Nginx) használatát, hogy mind a backendet, mind a frontendet kiszolgáld.

--------------------------------------------------------------------------------------------------------------------
ENGLISH VERSION
--------------------------------------------------------------------------------------------------------------------


# Project Overview

This project consists of a **backend** built with Python (Flask) and a **frontend** built with React. The backend and frontend are containerized using Docker for easy deployment and development.

## Prerequisites

Before running the project, ensure you have the following installed:

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/)

## Project Structure

- **backend/**: Contains the Flask backend application.
- **frontend/**: Contains the React frontend application.
- **greenlet/**: Contains C header files for the `greenlet` library.
- **Lib/** and **Scripts/**: Python virtual environment files.

## Running the Project

### Cloning the Repository

1. **Clone the repository** using Git:

   ```sh
   git clone https://github.com/HDenes8/react-flusk-testsite-2025.git
   ```

2. **Navigate to the root directory of the project**:

   ```sh
   cd react-flusk-testsite-2025
   ```

### Using Docker Compose

3. **Build and start the containers** using Docker Compose:

   ```sh
   docker-compose up --build
   ```

   - The `--build` flag ensures that the containers are rebuilt if there are any changes in the code or dependencies.

4. **Wait for the containers to start**:
   - Docker Compose will pull any necessary images, build the containers, and start the services.
   - You should see logs in the terminal indicating that the backend and frontend services have started successfully.

5. **Access the application**:
   - The **backend** (Flask API) will be available at:  
     `http://localhost:5000`
   - The **frontend** (React app) will be available at:  
     `http://localhost:3000`

   Open these URLs in your browser to verify that the application is running.

6. **Stopping the containers**:
   - To stop the containers, press `Ctrl+C` in the terminal where Docker Compose is running.
   - Then, clean up the containers and networks by running:

     ```sh
     docker-compose down
     ```

7. **Rebuilding the containers**:
   - If you make changes to the code and need to rebuild the containers, use:

     ```sh
     docker-compose up --build
     ```

### What to Expect

- When you visit `http://localhost:5000`:
  - You should see the backend API's default response (e.g., a JSON message or a "Welcome" message, depending on how the Flask app is configured).

- When you visit `http://localhost:3000`:
  - You should see the React frontend application loaded in your browser.

### Troubleshooting

- If the containers fail to start, check the logs for errors:

  ```sh
  docker-compose logs
  ```

- If a specific service (e.g., `backend`) fails, you can view its logs:

  ```sh
  docker-compose logs backend
  ```

- Ensure that no other applications are using ports `5000` or `3000`. If these ports are in use, you can modify the `docker-compose.yml` file to use different ports.

## Notes

- Ensure that the backend and frontend are configured to communicate with each other. Update the API URLs in the frontend code if necessary.
- For production deployment, consider using a reverse proxy (e.g., Nginx) to serve both the backend and frontend.

## Deploying to a Cloud Host

The application can be split between a static frontend and a Python backend with a managed PostgreSQL database.  A simple free setup is:

1. **Backend + DB** on a platform like Render, Railway, or Fly.io.
   - Create a PostgreSQL instance and note the `DATABASE_URL` it provides.
   - Create a web service using this repo's `backend/` folder.
   - Add environment variables: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS` (e.g. `https://<your‑frontend>`).
   - Build command: `pip install -r requirements.txt`.
   - Start command: `gunicorn app:app` (make sure `gunicorn` is listed in requirements) or `python app.py`.

2. **Frontend** on Vercel, Netlify or similar.  Use the `frontend/` folder.
   - Set `REACT_APP_API_BASE_URL` to the backend's public URL.

3. **Push to GitHub** and connect the services to the repository.  They will deploy automatically.

Remember to commit the `.env.example` files and update your local `.env` for development.

These steps are described in detail in the repository's deploy notes (see section above).