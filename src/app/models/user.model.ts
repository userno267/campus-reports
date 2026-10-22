export type Role = 'faculty' | 'admin' | 'personnel';

// What the rest of the app sees. The password hash never leaves DatabaseService.
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  xp: number; // kept to match the spec; real XP is always SUM(xp_log)
}