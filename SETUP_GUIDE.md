# Backend Setup Guide - MongoDB & Google OAuth

## Step-by-Step Instructions

### 1. Set Up MongoDB Atlas (Free Database)

1. **Go to MongoDB Atlas**: https://www.mongodb.com/cloud/atlas/register
   
2. **Create an account**:
   - Sign up with your email or Google account
   - Choose the FREE tier (M0 Sandbox)

3. **Create a cluster**:
   - Click "Build a Database"
   - Select "M0 FREE" option
   - Choose a cloud provider (AWS recommended)
   - Pick a region close to you
   - Click "Create Cluster"

4. **Set up database access**:
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Authentication Method: Password
   - Username: choose any (e.g., `trippyuser`)
   - Password: click "Autogenerate Secure Password" and SAVE IT
   - Database User Privileges: select "Read and write to any database"
   - Click "Add User"

5. **Set up network access**:
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Confirm

6. **Get your connection string**:
   - Go to "Database" in the left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Driver: Node.js, Version: 5.5 or later
   - Copy the connection string (looks like: `mongodb+srv://username:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`)
   - Replace `<password>` with your actual password from step 4
   - Add your database name after `.net/` (e.g., `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/trippy?retryWrites=true&w=majority`)

### 2. Set Up Google OAuth

1. **Go to Google Cloud Console**: https://console.cloud.google.com/

2. **Create a new project**:
   - Click the project dropdown at the top
   - Click "New Project"
   - Name: "Trippy" (or whatever you want)
   - Click "Create"

3. **Enable Google+ API**:
   - Select your project
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click on it and click "Enable"

4. **Configure OAuth consent screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - User Type: Select "External"
   - Click "Create"
   - App name: "Trippy"
   - User support email: your email
   - Developer contact: your email
   - Click "Save and Continue"
   - Scopes: Click "Save and Continue" (skip for now)
   - Test users: Click "Add Users" and add your email
   - Click "Save and Continue"

5. **Create OAuth credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: "Trippy Web Client"
   - Authorized JavaScript origins:
     - Add: `http://localhost:3000`
   - Authorized redirect URIs:
     - Add: `http://localhost:3000/api/auth/callback/google`
   - Click "Create"
   - **SAVE YOUR CLIENT ID AND CLIENT SECRET**

### 3. Generate NextAuth Secret

1. **Open PowerShell** and run:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   
2. **Copy the output** - this is your NEXTAUTH_SECRET

### 4. Create Your .env.local File

1. **In your project root**, create a file named `.env.local`

2. **Add these variables** (replace with your actual values):
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/trippy?retryWrites=true&w=majority
   
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_generated_secret_from_step_3
   
   GOOGLE_CLIENT_ID=your_google_client_id_from_step_2
   GOOGLE_CLIENT_SECRET=your_google_client_secret_from_step_2
   ```

### 5. Run Your App

1. **Install dependencies** (if not already done):
   ```powershell
   npm install
   ```

2. **Start the development server**:
   ```powershell
   npm run dev
   ```

3. **Open your browser**: http://localhost:3000

4. **Test the login**:
   - Click the "Login" button
   - Sign in with Google
   - You should see your profile picture and name appear
   - Check MongoDB Atlas - you should see a new user in the database!

## What I Created For You

### Backend Files:
- `lib/mongodb.ts` - Database connection with caching
- `lib/auth.ts` - NextAuth configuration
- `models/User.ts` - User database schema
- `models/Trip.ts` - Trip database schema
- `app/api/auth/[...nextauth]/route.ts` - Authentication endpoints
- `app/api/trips/route.ts` - Get all trips, Create trip
- `app/api/trips/[id]/route.ts` - Get, Update, Delete single trip

### Frontend Files:
- `components/AuthProvider.tsx` - Session provider wrapper
- Updated `app/layout.tsx` - Added auth provider
- Updated `app/page.tsx` - Added login/logout functionality with user profile

### Config Files:
- `types/next-auth.d.ts` - TypeScript types for NextAuth
- `.env.example` - Template for environment variables

## API Endpoints You Can Use

### Authentication
- Handled automatically by NextAuth at `/api/auth/*`

### Trips
- `GET /api/trips` - Get all trips for logged-in user
- `POST /api/trips` - Create a new trip
  ```json
  {
    "destination": "Italy, Manarola",
    "startDate": "2024-06-01",
    "endDate": "2024-06-07",
    "activities": []
  }
  ```
- `GET /api/trips/[id]` - Get single trip
- `PUT /api/trips/[id]` - Update trip
- `DELETE /api/trips/[id]` - Delete trip

## Troubleshooting

### MongoDB Connection Issues
- Make sure you replaced `<password>` with your actual password
- Check that you added your IP to "Network Access" in MongoDB Atlas
- Verify the database name is in the connection string

### Google OAuth Issues
- Make sure you added `http://localhost:3000` to Authorized JavaScript origins
- Make sure you added `http://localhost:3000/api/auth/callback/google` to Authorized redirect URIs
- Check that you're using the correct Client ID and Secret
- Make sure you added yourself as a test user in the OAuth consent screen

### Environment Variables Not Loading
- Make sure the file is named exactly `.env.local` (not `.env.local.txt`)
- Restart your dev server after creating the file
- Check for typos in variable names

## Next Steps

You now have:
- ✅ User authentication with Google
- ✅ MongoDB database connected
- ✅ User model for storing user data
- ✅ Trip model for storing trip itineraries
- ✅ Protected API routes that require login
- ✅ Frontend showing login/logout with user profile

You can now build features that:
- Save trips to the database
- Load user's saved trips
- Create personalized experiences based on the logged-in user
