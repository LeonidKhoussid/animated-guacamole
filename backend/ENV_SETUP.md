# Environment Variables Setup

## Required Variables

### Database
```env
DATABASE_URL=postgresql://postgres@localhost:5432/plan_ai?schema=public&client_encoding=UTF8
```

**Important**: Make sure your PostgreSQL database is created with UTF8 encoding. If you're getting encoding errors, you can fix it by:
1. Adding `&client_encoding=UTF8` to your DATABASE_URL (as shown above)
2. Or recreating the database with UTF8: `CREATE DATABASE plan_ai WITH ENCODING 'UTF8';`

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

## AI Integration (OpenRouter)

```env
OPENROUTER_API_KEY=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
```

The AI service uses the free model: `x-ai/grok-4.1-fast:free`

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


