import React from "react";
import { SignUp } from "@clerk/clerk-react";

const SignupChatteur: React.FC = () => (
  <div className="min-h-screen bg-imperium-navy flex flex-col items-center justify-center">
    <header className="w-full bg-imperium-navy text-imperium-gold p-6 text-4xl font-extrabold tracking-widest shadow text-center mb-8">
      Imperium - Inscription Chatteur
    </header>
    <div className="bg-imperium-marble rounded-lg shadow p-8 w-full max-w-md">
      <SignUp
        path="/signup-chatteur"
        routing="path"
        afterSignUpUrl="/chatteur"
        appearance={{
          elements: {
            formButtonPrimary: "bg-imperium-gold text-imperium-navy font-bold",
          },
        }}
      />
      <p className="mt-4 text-imperium-navy text-center text-sm opacity-70">
        En vous inscrivant, votre compte sera automatiquement configuré comme chatteur.
      </p>
    </div>
  </div>
);

export default SignupChatteur; 