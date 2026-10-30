// 'personnel' was renamed to 'staff' to match the database.
export type Role = 'faculty' | 'admin' | 'staff';

// What the rest of the app sees. The API never sends the password hash.
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  employee_id: string;
  department_id: number | null;     // only staff have a department
  department_name: string | null;
}

export interface Department {
  id: number;
  name: string;
}

// What the register form sends. Admin is never allowed here.
export interface RegisterInput {
  name: string;
  email: string;
  employee_id: string;
  password: string;
  role: 'faculty' | 'staff';
  department_id: number | null;     // required when role is 'staff'
}