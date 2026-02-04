import { Link, Form } from "react-router";
import { Vote, ShieldCheck, Menu, LogOut, User } from "lucide-react";

interface HeaderProps {
  user?: {
    id: string;
    username: string;
    role: string;
  } | null;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Vote className="h-8 w-8 text-red-500" />
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">Election Tracker BD</h1>
            <p className="text-xs text-slate-400 font-mono">Private & Independent Watch</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/" className="text-sm font-medium hover:text-red-400 transition-colors">
            Live Dashboard
          </Link>
          
          <div className="relative group">
            <button className="text-sm font-medium hover:text-red-400 transition-colors flex items-center">
              Locations
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-slate-800">
              <Link to="/division" className="block px-4 py-2 text-sm hover:bg-slate-100">Divisions</Link>
              <Link to="/district" className="block px-4 py-2 text-sm hover:bg-slate-100">Districts</Link>
              <Link to="/upazila" className="block px-4 py-2 text-sm hover:bg-slate-100">Upazilas</Link>
              <Link to="/union" className="block px-4 py-2 text-sm hover:bg-slate-100">Unions</Link>
              <Link to="/centers" className="block px-4 py-2 text-sm hover:bg-slate-100">Vote Centers</Link>
            </div>
          </div>

          {user && (
            <Link to="/admin" className="text-sm font-medium hover:text-red-400 transition-colors">
              Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          {user ? (
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center text-xs text-slate-300">
                <User className="h-3 w-3 mr-1" />
                {user.username}
              </div>
              <Form action="/logout" method="post">
                <button 
                  type="submit"
                  className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded text-sm font-bold transition-all border border-slate-700"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </Form>
            </div>
          ) : (
            <Link 
              to="/login" 
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-bold transition-all"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Login</span>
            </Link>
          )}
          <button className="md:hidden p-2">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
      
      {/* Breaking News Ticker (Mock) */}
      <div className="bg-red-700 text-white text-xs font-bold py-1 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block px-4">
          LIVE: Vote counting in progress across 64 districts... 
          <span className="mx-4">•</span> 
          Dhaka Division showing high turnout...
          <span className="mx-4">•</span> 
          Updates every 60 seconds.
        </div>
      </div>
    </header>
  );
}
