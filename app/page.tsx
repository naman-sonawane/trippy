'use client';

import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";

const NavigationBar = () => {
  const { data: session, status } = useSession();

  const handleAuthClick = () => {
    if (session) {
      signOut();
    } else {
      signIn('google');
    }
  };

  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 px-8 py-6 flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <Image src="/logo.png" alt="Trippy" width={40} height={40} className="w-10 h-10" />
        <span className="text-white text-2xl font-normal" style={{ fontFamily: 'var(--font-dm-sans)' }}>trippy</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 text-white text-base">
        <a href="#" className="hover:opacity-70 transition-opacity">Hotels</a>
        <a href="#" className="hover:opacity-70 transition-opacity">Tours</a>
        <a href="#" className="hover:opacity-70 transition-opacity">Flights</a>
        <a href="#" className="hover:opacity-70 transition-opacity">Packages</a>
        <a href="#" className="hover:opacity-70 transition-opacity">Cruises</a>
      </div>

      <div className="flex items-center gap-4">
        {session?.user && (
          <div className="flex items-center gap-3">
            {session.user.image && (
              <Image 
                src={session.user.image} 
                alt={session.user.name || "User"} 
                width={36} 
                height={36} 
                className="rounded-full"
              />
            )}
            <span className="text-white text-sm hidden lg:block">{session.user.name}</span>
          </div>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAuthClick}
          disabled={status === 'loading'}
          className="bg-white text-black px-8 py-3 rounded-full text-base font-medium hover:bg-opacity-90 transition-all disabled:opacity-50"
        >
          {status === 'loading' ? 'Loading...' : session ? 'Logout' : 'Login'}
        </motion.button>
      </div>
    </motion.nav>
  );
};

const ImageCard = ({ src, alt, index }: { src: string; alt: string; index: number }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.8 + index * 0.1, ease: "easeOut" }}
      whileHover={{ scale: 1.05 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative w-[360px] h-[260px]"
    >
      <Image
        src={src}
        alt={alt}
        width={360}
        height={260}
        className="rounded-lg w-full h-full"
      />
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
            style={{ 
              fontFamily: 'var(--font-dm-sans)'
            }}
          >
            {alt}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/landingbg.jpg)',
          filter: 'brightness(0.85)',
        }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-blue-900/20" />

      <NavigationBar />

      <div className="relative z-10 h-screen flex items-center">
        <div className="container mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-white space-y-6"
            >
              <div>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-xl mb-2"
                  style={{ fontFamily: 'var(--font-fraunces)' }}
                >
                  Italy,
                </motion.h2>
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-6xl mb-4"
                  style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 400 }}
                >
                  Manarola
                </motion.h1>
              </div>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-base leading-relaxed max-w-lg"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                One of the charming fishing villages of the vibrant Cinque Terre, Manarola is dotted with grapevines, lemon trees, and medieval fortifications, offering views that are nothing short of breathtaking.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex items-center gap-3 text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="font-light">I&apos;m feeling lucky...</span>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="space-y-3"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white text-black px-8 py-4 rounded-full text-base font-medium hover:bg-opacity-90 transition-all shadow-lg"
                >
                  Try Trippy
                </motion.button>
                <p className="text-sm text-white/80 font-light">
                  Plan your entire itinerary with just one click.
                </p>
              </motion.div>
            </motion.div>

            <div className="absolute right-0 hidden lg:block w-[500px] h-[600px]">
              <div className="absolute top-12 -right-16 z-10">
                <ImageCard src="/Stella Boat Tour.png" alt="Stella Boat Tour" index={0} />
              </div>
              <div className="absolute top-44 -right-12 z-20">
                <ImageCard src="/Manarola Downtown.png" alt="Manarola Downtown" index={1} />
              </div>
              <div className="absolute top-76 -right-8 z-30">
                <ImageCard src="/Bar Enrica.png" alt="Bar Enrica" index={2} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
