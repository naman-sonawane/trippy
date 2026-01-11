import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      await connectDB();

      const existingUser = await User.findOne({ email: user.email });

      if (!existingUser) {
        await User.create({
          email: user.email,
          name: user.name,
          image: user.image,
          googleId: account?.providerAccountId,
          emailVerified: new Date(),
        });
      } else if (account?.providerAccountId && !existingUser.googleId) {
        existingUser.googleId = account.providerAccountId;
        await existingUser.save();
      }

      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        await connectDB();
        const dbUser = await User.findOne({ email: session.user.email });
        if (dbUser) {
          session.user.id = dbUser._id.toString();
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
