# Swagger API Documentation

## Accessing Swagger UI

Once the backend server is running, you can access the Swagger UI at:

**http://localhost:3001/docs**

## Features

- **Interactive API Documentation**: Browse all available endpoints
- **Try It Out**: Test API endpoints directly from the browser
- **Schema Definitions**: View request/response schemas
- **Authentication**: Test endpoints with JWT tokens

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - User login
- `POST /admin/login` - Admin login

### Plans
- `POST /plans/upload` - Upload floor plan image (requires auth)
- `GET /plans/:id` - Get plan by ID (requires auth)

### AI
- `POST /ai/request` - Create AI replanning request (requires auth)
- `GET /ai/history` - Get user chat history (requires auth)
- `GET /ai/requests/:id` - Get AI request with variants (requires auth)
- `GET /ai/stream/:request_id` - WebSocket stream for AI responses (requires auth)

### Variants
- `GET /variants/:id` - Get variant details (requires auth)
- `GET /share/:variant_id` - Get public variant (no auth required)

### Favorites
- `POST /favorites` - Add variant to favorites (requires auth)
- `GET /favorites` - Get user favorites (requires auth)
- `DELETE /favorites/:variant_id` - Remove from favorites (requires auth)

### Applications
- `POST /applications` - Submit application to BTI (requires auth)
- `GET /applications/:id` - Get application by ID (requires auth)

### Admin
- `GET /admin/applications` - Get all applications (admin only)
- `GET /admin/applications/:id` - Get application details (admin only)
- `POST /admin/applications/:id/decision` - Make decision on application (admin only)

## Authentication

Most endpoints require JWT authentication. To use authenticated endpoints in Swagger UI:

1. First, login using `/auth/login` or `/auth/register`
2. Copy the `token` from the response
3. Click the "Authorize" button at the top of the Swagger UI
4. Enter: `Bearer <your-token>`
5. Click "Authorize" and "Close"

Now you can test authenticated endpoints!

## OpenAPI JSON

The OpenAPI specification is available at:

**http://localhost:3001/docs/json**

This can be imported into Postman, Insomnia, or other API clients.

