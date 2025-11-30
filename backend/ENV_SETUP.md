# Environment Variables Setup

## Required Variables

### Database

CORS_ORIGINS=https://animated-guacamole-7ahp.onrender.com,https://eloquent-sunflower-d11879.netlify.app
```

```env
DATABASE_URL=postgresql://someone:loler123@272a037a1d5a257ba4662930.twc1.net:5432/plan_ai?schema=public&client_encoding=UTF8
```

**Важно:** параметр `client_encoding=UTF8` обязателен для корректной кириллицы.

### Authentication

```env
JWT_SECRET=your-secret-key-change-in-production
ADMIN_JWT_SECRET=your-admin-secret-key-change-in-production
```

### Server

```env
PORT=3001
NODE_ENV=development
BASE_URL=http://localhost:3001
```

## AI Integration (GigaChat)

```env
GIGACHAT_CLIENT_ID=your-client-id
GIGACHAT_CLIENT_SECRET=your-client-secret
GIGACHAT_SCOPE=GIGACHAT_API_PERS
```

The AI service uses GigaChat API for generating renovation variants in Russian.

### How to get GigaChat credentials:

1. Go to [GigaChat Developer Portal](https://developers.sber.ru/portal/products/gigachat)
2. Register and create an application
3. Get your Client ID and Client Secret
4. Set the scope to `GIGACHAT_API_PERS` for personal API access
5. Add the credentials to your `.env` file

## Yandex S3 Configuration

To use Yandex S3 for file storage, add these variables:

```env
YANDEX_S3_ENDPOINT=https://storage.yandexcloud.net
YANDEX_S3_REGION=ru-central1
YANDEX_S3_ACCESS_KEY_ID=your-access-key-id
YANDEX_S3_SECRET_ACCESS_KEY=your-secret-access-key
YANDEX_S3_BUCKET=your-bucket-name
YANDEX_S3_PUBLIC_URL=https://your-bucket-name.storage.yandexcloud.net
```

### How to get Yandex S3 credentials:

1. Go to [Yandex Cloud Console](https://console.cloud.yandex.ru/)
2. Create or select a cloud
3. Go to "Object Storage" → "Buckets"
4. Create a bucket
5. Go to "Service Accounts" → Create a service account
6. Assign the "Storage Editor" role to the service account
7. Create static access keys for the service account
8. Use the Access Key ID and Secret Access Key in your `.env`

### If S3 is not configured:

The system will automatically fall back to local file storage in the `backend/uploads/` directory.

## File Storage

If not using S3, files are stored locally:

```env
UPLOAD_DIR=./uploads
```
