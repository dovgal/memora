declare module "next-auth" {
    interface Session {
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
