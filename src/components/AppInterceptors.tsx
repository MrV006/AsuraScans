import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, X } from 'lucide-react';

export function AppInterceptors() {
  // Safe interceptors without manipulating window.history.state directly to avoid React Router location corruption
  return null;
}
