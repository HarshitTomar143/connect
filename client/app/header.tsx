"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "../components/ui/button";


function Avatar({ src, alt }: { src?: string; alt: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-8 w-8 rounded-full object-cover border border-gray-200"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium border border-gray-200">
      <span>👤</span>
    </div>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth() as unknown as {
    user: { displayName?: string; nickname?: string; avatar?: string } | null;
    logout: () => Promise<void>;
  };

  const name = user?.nickname || user?.displayName || "";


  if (pathname?.startsWith("/login") || pathname?.startsWith("/register")) {
    return null;
  }

  return (
    <header className="w-full border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold">
          Connect
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-700 hidden sm:inline">
                {name}
              </span>
              <Link href="/profile" className="text-sm underline">
                Profile
              </Link>
              <Avatar src={user.avatar} alt={name || "User"} />
              <Button
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">Login</Link>
              <span className="text-gray-300">/</span>
              <Link href="/register">Register</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
