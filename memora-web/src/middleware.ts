import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const pathname = req.nextUrl.pathname;
        const isAuthRoute = pathname.startsWith('/login');
        const isOnboardingRoute = pathname.startsWith('/onboarding');
        const isRoleSelectionRoute = pathname.startsWith('/role-selection');

        // If user is logged in
        if (token) {
            // Priority 1: Enforce onboarding for new users
            if (token.needsOnboarding && !isOnboardingRoute) {
                return NextResponse.redirect(new URL('/onboarding', req.url));
            }

            // Priority 2: Enforce role selection after onboarding
            if (!token.needsOnboarding && token.needsRoleSelection && !isRoleSelectionRoute) {
                return NextResponse.redirect(new URL('/role-selection', req.url));
            }

            // If they finished both, keep them away from login/onboarding/role-selection
            const isSetupRoute = isAuthRoute || isOnboardingRoute || isRoleSelectionRoute;
            if (!token.needsOnboarding && !token.needsRoleSelection && isSetupRoute) {
                return NextResponse.redirect(new URL('/dashboard', req.url));
            }

            // Role-Based Access Control
            if (!token.needsRoleSelection && token.role) {
                // If they go to naked /dashboard, route them to their specific area
                if (pathname === '/dashboard') {
                    return NextResponse.redirect(new URL(`/dashboard/${token.role}`, req.url));
                }

                // Block students from teacher routes
                if (token.role === 'student' && pathname.startsWith('/dashboard/teacher')) {
                    return NextResponse.redirect(new URL('/dashboard/student', req.url));
                }

                // Block teachers from student routes
                if (token.role === 'teacher' && pathname.startsWith('/dashboard/student')) {
                    return NextResponse.redirect(new URL('/dashboard/teacher', req.url));
                }
            }
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ req, token }) => {
                const pathname = req.nextUrl.pathname;
                if (pathname.startsWith('/dashboard') || pathname.startsWith('/courses') || pathname.startsWith('/cabinet') || pathname.startsWith('/classes') || pathname.startsWith('/onboarding') || pathname.startsWith('/role-selection')) {
                    return !!token;
                }
                return true;
            },
        }
    }
)

export const config = {
    matcher: ['/dashboard/:path*', '/courses', '/courses/:path*', '/cabinet', '/classes/:path*', '/onboarding', '/role-selection', '/login'],
}
