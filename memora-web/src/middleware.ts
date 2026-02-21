import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const isAuthRoute = req.nextUrl.pathname.startsWith('/login');
        const isOnboardingRoute = req.nextUrl.pathname.startsWith('/onboarding');

        // If user is logged in
        if (token) {
            // Enforce onboarding for new users
            if (token.needsOnboarding && !isOnboardingRoute) {
                return NextResponse.redirect(new URL('/onboarding', req.url));
            }

            // If they finished onboarding, keep them away from login/onboarding
            if (!token.needsOnboarding && (isAuthRoute || isOnboardingRoute)) {
                return NextResponse.redirect(new URL('/dashboard', req.url));
            }
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ req, token }) => {
                // By default, only protect /dashboard routes, let people access /login and public routes freely
                if (req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname.startsWith('/onboarding')) {
                    return !!token;
                }
                return true;
            },
        }
    }
)

export const config = {
    matcher: ['/dashboard/:path*', '/onboarding', '/login'],
}
