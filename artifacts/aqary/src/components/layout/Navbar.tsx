import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Menu, UserCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navLinks = [
    { href: "/", label: "الرئيسية" },
    { href: "/properties", label: "تصفح العقارات" },
  ];

  if (user?.role === "seller") {
    navLinks.push({ href: "/dashboard", label: "لوحة التحكم" });
  } else if (user?.role === "admin") {
    navLinks.push({ href: "/admin", label: "لوحة الإدارة" });
  }

  if (user) {
    navLinks.push({ href: "/saved", label: "المحفوظات" });
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary">عقاري</span>
          </Link>
          
          <div className="hidden md:flex gap-6">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${location === link.href ? "text-primary" : "text-muted-foreground"}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UserCircle className="h-5 w-5" />
                <span>مرحباً، {user.name}</span>
              </div>
              <Button variant="outline" size="sm" onClick={logout} className="gap-2">
                <LogOut className="h-4 w-4" />
                تسجيل خروج
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/login">دخول</Link>
              </Button>
              <Button asChild>
                <Link href="/register">حساب جديد</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-6 py-6">
                <Link href="/" className="flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-primary" />
                  <span className="text-xl font-bold text-primary">عقاري</span>
                </Link>
                
                <div className="flex flex-col gap-4">
                  {navLinks.map((link) => (
                    <Link 
                      key={link.href} 
                      href={link.href}
                      className={`text-sm font-medium transition-colors hover:text-primary ${location === link.href ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>

                <div className="mt-auto border-t pt-6">
                  {user ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <UserCircle className="h-5 w-5" />
                        <span>مرحباً، {user.name}</span>
                      </div>
                      <Button variant="outline" onClick={logout} className="w-full gap-2 justify-center">
                        <LogOut className="h-4 w-4" />
                        تسجيل خروج
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" className="w-full" asChild>
                        <Link href="/login">دخول</Link>
                      </Button>
                      <Button className="w-full" asChild>
                        <Link href="/register">حساب جديد</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
