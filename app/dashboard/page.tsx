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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Trippy" width={36} height={36} className="w-9 h-9" />
            <span className="text-2xl font-normal" style={{ fontFamily: 'var(--font-dm-sans)' }}>trippy</span>
          </div>

          <div className="flex items-center gap-4">
            {session.user.image && (
              <Image 
                src={session.user.image} 
                alt={session.user.name || "User"} 
                width={40} 
                height={40} 
                className="rounded-full"
              />
            )}
            <div className="text-right">
              <div className="font-medium text-gray-900">{session.user.name}</div>
              <div className="text-sm text-gray-500">{session.user.email}</div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => signOut({ callbackUrl: '/' })}
              className="bg-red-500 text-white px-6 py-2 rounded-full text-sm font-medium hover:bg-red-600 transition-all"
            >
              Logout
            </motion.button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Welcome back, {session.user.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 mb-8">Plan your next adventure with trippy</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/recommendations')}
          >
            <div className="text-4xl mb-4">💝</div>
            <h3 className="text-xl font-semibold mb-2">Discover Places</h3>
            <p className="text-gray-600">Swipe through personalized recommendations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/new-trip')}
          >
            <div className="text-4xl mb-4">✈️</div>
            <h3 className="text-xl font-semibold mb-2">Create New Trip</h3>
            <p className="text-gray-600">Start planning your next adventure</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/recommendations')}
          >
            <div className="text-4xl mb-4">💝</div>
            <h3 className="text-xl font-semibold mb-2">Discover Places</h3>
            <p className="text-gray-600">Swipe through personalized recommendations</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-4xl mb-4">📍</div>
            <h3 className="text-xl font-semibold mb-2">My Trips</h3>
            <p className="text-gray-600">View all your saved itineraries</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 bg-white rounded-xl shadow-md p-8"
        >
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-fraunces)' }}>Recent Trips</h2>
          <div className="text-gray-500 text-center py-8">
            No trips yet. Create your first trip to get started!
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
