'use client';

import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const Dashboard = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{
             backgroundImage: "url(/dashbg.jpg)",
             backgroundSize: "cover",
             backgroundPosition: "center"
           }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
        <div className="text-xl text-white relative z-10" style={{ fontFamily: 'var(--font-dm-sans)' }}>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen relative"
         style={{
           backgroundImage: "url(/dashbg.jpg)",
           backgroundSize: "cover",
           backgroundPosition: "center"
         }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
      
      <nav className="relative z-10 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Trippy" width={36} height={36} className="w-9 h-9" />
            <span className="text-2xl font-normal text-white" style={{ fontFamily: 'var(--font-dm-sans)' }}>trippy</span>
          </div>

          <div className="flex items-center gap-4">
            {session.user.image && (
              <Image 
                src={session.user.image} 
                alt={session.user.name || "User"} 
                width={40} 
                height={40} 
                className="rounded-full border-2 border-white/20"
              />
            )}
            <div className="text-right">
              <div className="font-medium text-white" style={{ fontFamily: 'var(--font-dm-sans)' }}>{session.user.name}</div>
              <div className="text-sm text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>{session.user.email}</div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => signOut({ callbackUrl: '/' })}
              className="bg-white text-black px-6 py-2 rounded-full text-sm font-medium hover:bg-opacity-90 transition-all"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Logout
            </motion.button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Welcome back, {session.user.name?.split(' ')[0]}!
          </h1>
          <p className="text-white/80 mb-8" style={{ fontFamily: 'var(--font-dm-sans)' }}>Plan your next adventure with trippy</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white/10 backdrop-blur-md rounded-xl shadow-md p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20"
            onClick={() => router.push('/recommendations')}
          >
            <div className="w-12 h-12 mb-4 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>Discover Places</h3>
            <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>Swipe through personalized recommendations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white/10 backdrop-blur-md rounded-xl shadow-md p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20"
            onClick={() => router.push('/new-trip')}
          >
            <div className="w-12 h-12 mb-4 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>Create New Trip</h3>
            <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>Start planning your next adventure</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white/10 backdrop-blur-md rounded-xl shadow-md p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20"
          >
            <div className="w-12 h-12 mb-4 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>Shared Trips</h3>
            <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>View trips shared with you by others</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white/10 backdrop-blur-md rounded-xl shadow-md p-6 hover:bg-white/20 transition-all cursor-pointer border border-white/20"
          >
            <div className="w-12 h-12 mb-4 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>My Trips</h3>
            <p className="text-white/80" style={{ fontFamily: 'var(--font-dm-sans)' }}>View all your saved itineraries</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 bg-white/10 backdrop-blur-md rounded-xl shadow-md p-8 border border-white/20"
        >
          <h2 className="text-2xl font-bold mb-4 text-white" style={{ fontFamily: 'var(--font-fraunces)' }}>Recent Trips</h2>
          <div className="text-white/80 text-center py-8" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            No trips yet. Create your first trip to get started!
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
