// Stub mock — next-auth has been removed from the project but some transitive
// imports still resolve it during Jest module loading.
export default function NextAuth() {
  return { auth: jest.fn(), handlers: {}, signIn: jest.fn(), signOut: jest.fn() };
}
export const auth = jest.fn();
export const signIn = jest.fn();
export const signOut = jest.fn();
