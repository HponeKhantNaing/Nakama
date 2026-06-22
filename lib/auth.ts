import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { SESSION_LONG_SECONDS, SESSION_SHORT_SECONDS } from '@/lib/auth-constants';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember Me', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { company: true },
        });

        if (!user || !user.isActive) {
          throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
          rememberMe: credentials.rememberMe === 'true',
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: SESSION_LONG_SECONDS,
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email ?? undefined;
        token.name = user.name ?? undefined;
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        const maxAge = user.rememberMe ? SESSION_LONG_SECONDS : SESSION_SHORT_SECONDS;
        token.exp = Math.floor(Date.now() / 1000) + maxAge;
      }
      if (trigger === 'update' && session && typeof session === 'object' && 'name' in session) {
        const nextName = (session as { name?: string }).name;
        if (nextName) token.name = nextName;
      }
      return token;
    },
    async session({ session, token }) {
      const email = (token.email as string | undefined) ?? session.user?.email ?? undefined;

      if (session.user && email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        });

        if (dbUser?.isActive) {
          session.user.id = dbUser.id;
          session.user.name = dbUser.name;
          session.user.role = dbUser.role;
          session.user.companyId = dbUser.companyId;
          session.user.companyName = dbUser.company.name;
        } else if (token.id) {
          session.user.id = token.id as string;
          session.user.name = (token.name as string | undefined) ?? session.user.name;
          session.user.role = token.role;
          session.user.companyId = token.companyId;
          session.user.companyName = token.companyName;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
