import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, LogOut, LayoutDashboard, Sun, Moon, User, History, Video } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Navbar({ user, onLogout }: { user: any, onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/history', label: 'History', icon: History },
    { to: '/video-lab', label: 'Video Lab', icon: Video },
  ];

  return (
    <nav className="border-b border-app-border bg-app-bg/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="bg-emerald-500/10 p-1.5 rounded-xl border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors"
            >
              <Shield className="w-6 h-6 text-emerald-500" />
            </motion.div>
            <span className="text-xl font-bold tracking-tight">
              KYC<span className="text-emerald-500 group-hover:text-emerald-400 transition-colors">BUSTER</span>
            </span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-8">
            <div className="hidden sm:flex items-center gap-2">
              {navLinks.map((link) => (
                <Link 
                  key={link.to}
                  to={link.to} 
                  className={cn(
                    "text-sm font-medium transition-all items-center gap-2 px-3 py-1.5 rounded-lg flex",
                    location.pathname === link.to 
                      ? "bg-emerald-500/10 text-emerald-500 opacity-100" 
                      : "opacity-60 hover:opacity-100 hover:bg-app-card"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
            </div>
            
            <div className="hidden sm:block h-6 w-[1px] bg-app-border/50" />
            
            <div className="flex items-center gap-2 sm:gap-4">
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="p-2.5 rounded-xl hover:bg-app-card border border-transparent hover:border-app-border transition-all relative overflow-hidden group"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={theme}
                    initial={{ y: 20, opacity: 0, rotate: 45 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: -20, opacity: 0, rotate: -45 }}
                    transition={{ duration: 0.2 }}
                  >
                    {theme === 'dark' ? (
                      <Sun className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Moon className="w-5 h-5 text-indigo-500" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.button>

              <div className="flex items-center gap-3 pl-2 border-l border-app-border/50">
                <div className="flex flex-col items-end hidden xs:flex">
                  <span className="text-sm font-bold leading-none mb-1">{user.fullName}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-black bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {user.role}
                    </span>
                  </div>
                </div>
                
                <div className="w-9 h-9 rounded-xl bg-app-card border border-app-border flex items-center justify-center text-emerald-500">
                  <User className="w-5 h-5" />
                </div>

                <motion.button 
                  whileHover={{ scale: 1.1, x: 2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { onLogout(); navigate('/login'); }}
                  className="p-2.5 rounded-xl hover:bg-red-500/10 text-red-500/40 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
