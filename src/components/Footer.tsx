import React from 'react';
import { Shield, Github, Linkedin, Heart, Globe, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-app-card border-t border-app-border mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-black" />
              </div>
              <span className="text-xl font-bold tracking-tight">KYC Buster</span>
            </div>
            <p className="text-sm opacity-50 max-w-sm leading-relaxed">
              Next-generation identity verification platform. Protecting businesses from deepfakes, 
              synthetic identity fraud, and document tampering using advanced AI.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-widest opacity-40">Platform</h4>
            <ul className="space-y-2 text-sm opacity-60">
              <li><a href="#" className="hover:text-emerald-500 transition-colors">How it works</a></li>
              <li><a href="#" className="hover:text-emerald-500 transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-emerald-500 transition-colors">API Documentation</a></li>
              <li><a href="#" className="hover:text-emerald-500 transition-colors">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-widest opacity-40">Connect</h4>
            <div className="flex flex-wrap gap-4">
              <a 
                href="https://athrav138.github.io/ATHARV-S-PORFOLIO-WEB/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-app-bg border border-app-border rounded-lg hover:border-emerald-500/50 transition-all group"
                title="Portfolio"
              >
                <Globe className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:text-emerald-500" />
              </a>
              <a 
                href="https://github.com/athrav138" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-app-bg border border-app-border rounded-lg hover:border-emerald-500/50 transition-all group"
                title="GitHub"
              >
                <Github className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:text-emerald-500" />
              </a>
              <a 
                href="https://www.linkedin.com/in/aps8830-5b0969352" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-app-bg border border-app-border rounded-lg hover:border-emerald-500/50 transition-all group"
                title="LinkedIn"
              >
                <Linkedin className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:text-emerald-500" />
              </a>
              <a 
                href="mailto:suryavanshiatharv072@gmail.com" 
                className="p-2 bg-app-bg border border-app-border rounded-lg hover:border-emerald-500/50 transition-all group"
                title="Email"
              >
                <Mail className="w-5 h-5 opacity-60 group-hover:opacity-100 group-hover:text-emerald-500" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="pt-8 border-t border-app-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs opacity-40">
            © 2026 KYC Buster. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs opacity-40">
            <span>Created with</span>
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            <span>by</span>
            <span className="font-bold text-app-text opacity-100">Atharv Milind Suryavanshi</span>
          </div>
          <div className="flex gap-6 text-xs opacity-40">
            <a href="#" className="hover:opacity-100 transition-opacity">Privacy Policy</a>
            <a href="#" className="hover:opacity-100 transition-opacity">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
