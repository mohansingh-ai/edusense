import React from "react";
import { Brain, Camera, EyeOff, ShieldCheck, Heart, Sparkles, BookOpen } from "lucide-react";

export default function AboutView() {
  return (
    <div id="about-view-root" className="max-w-4xl mx-auto px-6 py-6 space-y-12 animate-fade-in text-left text-gray-800 font-sans">
      {/* Intro Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-blue-650 text-xs font-semibold">
          <Brain className="w-3.5 h-3.5 text-blue-650" />
          <span>SZABIST Islamabad Smart Initiative</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 uppercase">
          About <span className="text-blue-600">EduSense</span>
        </h2>
        <p className="text-xs text-gray-400 font-mono tracking-widest uppercase font-semibold">
          AI-driven real-time classroom visual analytics
        </p>
        <p className="text-sm text-gray-500 leading-relaxed max-w-2xl mx-auto mt-2">
          EduSense is a groundbreaking educational technology framework deployed in computer laboratories and smart classrooms at SZABIST Islamabad. By checking attention, engagement, and understanding in real-time, the system allows educators to fine-tune instruction and pacing instantly.
        </p>
      </div>

      {/* Feature Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pillar 1: Webcam Landmark Eye-tracking */}
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-3">
          <div className="bg-blue-50 border border-blue-150 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600">
            <Camera className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Facial Landmark & Gaze Tracking
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed font-sans">
            The platform activates a local web camera capture stream to identify facial anchor matrices, measure blinking intervals in milliseconds, check eye-contact durations, and map head movement velocities. This telemetry translates directly into real-time classroom attention metrics.
          </p>
        </div>

        {/* Pillar 2: Dynamic Reinforcement Learning Policy */}
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-3">
          <div className="bg-blue-50 border border-blue-150 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            RL-Driven Policy Adaption
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed font-sans">
            A state-action reward policy matches student telemetry logs to specific actions: <span className="text-blue-600 font-mono font-bold">REINFORCE_CONCEPTS</span>, <span className="text-blue-600 font-mono font-bold">ADJUST_SPEED_DOWN</span>, and critical instructions. If students fall into a severe disengagement state, Gemini generates high-impact re-focus activities.
          </p>
        </div>

        {/* Pillar 3: Crypt Privacy Preserving Blurs */}
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-3">
          <div className="bg-blue-50 border border-blue-150 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600">
            <EyeOff className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Cryptographic Privacy Blurs
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed font-sans">
            To satisfy educational data safeguards, student video feed data remains local. Pixels undergo visual blurring and encryption at the edge before head vectors generate numeric values. Raw student faces are never recorded or transmitted to cloud platforms.
          </p>
        </div>

        {/* Pillar 4: Collaborative Classroom Interaction */}
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm space-y-3">
          <div className="bg-blue-50 border border-blue-150 w-10 h-10 rounded-xl flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Verified Token Sign-On
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed font-sans">
            EduSense utilizes direct Google Auth token verification synchronized with persistent Firestore schemas. Role permissions are handled to prevent spoofing: a student profile is limited to their own gaze logging and shared class rosters.
          </p>
        </div>
      </div>

      {/* Heart-filled conclusion on craftsmanship and SZABIST's mission */}
      <div className="bg-blue-50/50 border border-blue-150 p-6 rounded-xl text-center space-y-4 max-w-xl mx-auto shadow-inner">
        <div className="text-red-500 flex justify-center">
          <Heart className="w-6 h-6 fill-red-500 animate-pulse" />
        </div>
        <p className="text-xs text-gray-650 font-sans leading-relaxed">
          The SZABIST Islamabad Smart Classroom program seeks to enrich learning environments with empathetic, privacy-safe, real-time AI solutions. Built with exceptional layouts, clear typography, and optimized data synchronization.
        </p>
        <p className="text-[9px] text-gray-400 font-mono uppercase tracking-wider font-semibold">
          Managed by SZABIST Computer Science Department Islamabad
        </p>
      </div>
    </div>
  );
}
