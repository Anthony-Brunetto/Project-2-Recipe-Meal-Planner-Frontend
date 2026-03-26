# Recipe Meal Planner Frontend

Frontend client for the Recipe Meal Planner application.

## Team Members

- Anthony Brunetto
- Ciaran Moynihan
- Ivan Martinez
- Justin Martinez

## Tech Stack

- React 18
- Vite
- JavaScript
- Supabase Auth
- REST API integration

## Run Locally

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root.
4. Add the required environment variables:

```env
VITE_SUPABASE_URL=[your Supabase project URL]
VITE_SUPABASE_ANON_KEY=[your Supabase anon key]
VITE_API_BASE_URL=[your backend API base URL]
```

`VITE_API_BASE_URL` is optional if you want to use the hosted backend default:

```text
https://recipe-backend-production-2e13.up.railway.app
```

5. Start the development server:

```bash
npm run dev
```

6. The app will run on:

```text
http://localhost:5173
```

## Build for Production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Live Frontend URL

- [Add deployed frontend URL]

## Backend API URL

- https://recipe-backend-production-2e13.up.railway.app

## Design Mockup

- https://www.figma.com/board/9txvgcbR460dnoAY81RBaq/Welcome-to-FigJam?node-id=0-1&p=f&t=MrL9JWQFyWZcJFf0-0
