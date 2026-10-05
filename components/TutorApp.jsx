'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, Receipt, Download,
  Plus, Trash2, Check, Copy, X, Pencil, Circle, CheckCircle2, Send
} from 'lucide-react';