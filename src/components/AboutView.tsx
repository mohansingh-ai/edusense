import React from "react";
import { Brain, Camera, EyeOff, ShieldCheck, Heart, Sparkles, User, Code, Terminal, Cpu } from "lucide-react";

export default function AboutView() {
  const team = [
    {
      name: "Raja Soban",
      icon: Code,
      color: "from-blue-500 to-indigo-500",
      glow: "hover:border-indigo-400"
    },
    {
      name: "Hasnat Khan",
      icon: Cpu,
      color: "from-purple-500 to-pink-500",
      glow: "hover:border-purple-400"
    },
    {
      name: "Mubashir Azeem",
      icon: Terminal,
      color: "from-emerald-500 to-teal-500",
      glow: "hover:border-emerald-400"
    }
  ];

  return (
    <div id="about-view-root" className="max-w-5xl mx-auto px-6 py-10 space-y-16 text-left font-sans text-gray-800 relative overflow-hidden">
      {/* Self-contained CSS Animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes subtlePulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
      `}</style>

      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl -z-10 animate-float" />
      <div className="absolute bottom-10 left-0 w-80 h-80 bg-purple-100/40 rounded-full blur-3xl -z-10 animate-float" style={{ animationDelay: '2s' }} />

      {/* Title & Introduction Section */}
      <div className="text-center space-y-6 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-150 rounded-full px-4 py-1.5 shadow-sm">
          <Brain className="w-4 h-4 text-blue-600 animate-pulse" />
          <span className="text-xs font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent uppercase tracking-wider">
            Smart Classroom Initiative
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 leading-tight">
          ABOUT <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">EDUSENSE</span>
        </h1>
        <p className="text-xs font-mono font-bold text-gray-455 uppercase tracking-widest">
          AI-POWERED REAL-TIME STUDENT ENGAGEMENT TELEMETRY
        </p>
        <p className="text-base text-gray-650 leading-relaxed max-w-3xl mx-auto mt-4 font-normal">
          EduSense is a premium educational technology analytics platform. It leverages state-of-the-art web camera gaze calculations and expression modeling to capture attention, engagement, and understanding signals in real-time. This feedback loop helps smart classroom teachers refine their delivery pace, launch interactive reinforcements, and improve classroom outcomes.
        </p>
      </div>

      {/* Feature Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up delay-100">
        <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 space-y-4 group">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
            Facial Landmark & Gaze Tracking
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            The platform processes local camera feeds at the edge to capture 468 facial coordinates, measuring blink frequencies, direction vectors, and head pose angles to generate an accurate, live, attention metrics stream.
          </p>
        </div>

        <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 space-y-4 group">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
            Empathetic AI Strategy Advisor
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Real-time classroom attention logs are translated through a reinforcement learning scheme into actionable teaching prompts. Gemini automatically recommends pacing changes or generates custom quizzes to re-focus distracted students.
          </p>
        </div>

        <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 space-y-4 group">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
            <EyeOff className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
            Privacy-First Architecture
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Student privacy remains a core design tenet. Video processing is executed entirely within the client's web browser, and live feeds are blurred locally. Only anonymous numerical score parameters are stored in Firestore.
          </p>
        </div>

        <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 space-y-4 group">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">
            Secure Authentication Mapping
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Integrates secure Google Auth token routing synced with persistent Firestore schemas. Virtual student profiles automatically promote to authenticated Google accounts to protect course registration mappings.
          </p>
        </div>
      </div>

      {/* Team Creators Section */}
      <div className="space-y-8 animate-fade-in-up delay-200">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
            Meet the Development Team
          </h2>
          <p className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">
            THE ARCHITECTS BEHIND THE PLATFORM
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {team.map((member, index) => (
            <div 
              key={index}
              className={`bg-white border border-gray-150 rounded-2xl p-6 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-350 flex flex-col justify-between group cursor-default relative overflow-hidden`}
            >
              {/* Glowing card border indicator */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${member.color}`} />
              
              <div className="space-y-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${member.color} text-white flex items-center justify-center shadow-md transform group-hover:rotate-6 transition-all duration-300`}>
                  <member.icon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-900 text-lg tracking-tight group-hover:text-blue-600 transition-colors">
                    {member.name}
                  </h4>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* empthy footer block */}
      <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/70 border border-blue-150 p-8 rounded-3xl text-center space-y-4 max-w-2xl mx-auto shadow-inner animate-fade-in-up delay-300">
        <div className="flex justify-center text-red-500">
          <Heart className="w-7 h-7 fill-red-500 animate-pulse" />
        </div>
        <p className="text-xs text-gray-600 leading-relaxed max-w-md mx-auto font-medium font-sans">
          EduSense is designed to enrich classrooms with modern, privacy-safe AI. We built this platform to build deeper connections between student needs and instructor methods.
        </p>
      </div>
    </div>
  );
}
