# Apartment Replanning Web Application

AI-Assisted Apartment Replanning Web Application with User App and BTI Engineer Admin Panel.

## Features

- User registration and authentication
- Floor plan upload (JPG, PNG, PDF)
- AI-powered replanning suggestions (mock implementation)
- 3D visualization of apartment layouts
- Multiple view modes (3D, Top-view, First-person)
- Favorites system
- Shareable variant links
- BTI application submission
- Admin panel for BTI engineers

## Tech Stack

### Frontend

- React + Vite
- TailwindCSS
- React Router
- Three.js + React Three Fiber
- Axios

### Backend

- Node.js + Fastify
- PostgreSQL + Prisma
- JWT Authentication
- WebSocket for streaming

## Setup

### Prerequisites

- Node.js 18+ (20+ recommended)
- PostgreSQL database
- npm or yarn

### Backend Setup

1. Navigate to backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` and set:

- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://postgres@localhost:5432/plan_ai?schema=public`)
- `JWT_SECRET` - Secret for JWT tokens
- `ADMIN_JWT_SECRET` - Secret for admin JWT tokens
- `PORT` - Server port (default: 3001)
- `OPENROUTER_API_KEY` - Your OpenRouter API key for AI integration
- `YANDEX_S3_ENDPOINT` - Yandex S3 endpoint (default: `https://storage.yandexcloud.net`)
- `YANDEX_S3_REGION` - Yandex S3 region (default: `ru-central1`)
- `YANDEX_S3_ACCESS_KEY_ID` - Your Yandex S3 access key ID
- `YANDEX_S3_SECRET_ACCESS_KEY` - Your Yandex S3 secret access key
- `YANDEX_S3_BUCKET` - Your Yandex S3 bucket name
- `YANDEX_S3_PUBLIC_URL` - Public URL for your bucket (optional, auto-generated if not set)

4. Set up database:

```bash
npx prisma generate
npx prisma migrate dev
```

5. (Optional) Create an admin user:
   You can create an admin user by running a script or directly in the database. The password should be hashed with bcrypt.

6. Start the server:

```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:
   Create `.env` file:

```
VITE_API_BASE_URL=http://localhost:3001
```

4. Start the development server:

```bash
npm run dev
```

## Project Structure

```
plan_ai_cursor/
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth middleware
│   │   ├── utils/           # Utilities
│   │   └── models/          # Prisma client
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── uploads/              # Uploaded files
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks
│   │   ├── utils/           # Utilities
│   │   └── context/         # React context
│   └── public/
└── README.md
```

## API Endpoints

### Authentication

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /admin/login` - Admin login

### Plans

- `POST /plans/upload` - Upload floor plan
- `GET /plans/:id` - Get plan details

### AI

- `POST /ai/request` - Create AI request
- `WS /ai/stream/:request_id` - WebSocket stream for AI responses

### Variants

- `GET /variants/:id` - Get variant details
- `GET /share/:variant_id` - Public share endpoint

### Favorites

- `POST /favorites` - Add favorite
- `GET /favorites` - Get user favorites
- `DELETE /favorites/:variant_id` - Remove favorite

### Applications

- `POST /applications` - Submit application
- `GET /applications/:id` - Get application details

### Admin

- `GET /admin/applications` - List all applications
- `GET /admin/applications/:id` - Application details
- `POST /admin/applications/:id/decision` - Approve/Reject application

## Development Notes

- The AI service currently returns mock data. Replace `backend/src/services/ai.service.js` with real AI integration.
- File storage is local by default. Configure S3 or other cloud storage in `backend/src/utils/fileStorage.js`.
- 3D models are primitive representations. Replace with GLB/GLTF files in production.

## License

ISC
