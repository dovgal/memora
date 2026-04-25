import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session extends DefaultSession {
        id_token: string;
        user: {
            id: string;
            email: string;
            role: string;
        }
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string;
        role?: string;
        needsOnboarding?: boolean;
        needsRoleSelection?: boolean;
    }
}
