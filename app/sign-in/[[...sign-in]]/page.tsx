import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#FAF6EE] p-4"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src="/aluta-logo.png"
            alt="Aluta"
            className="w-16 h-16 mx-auto rounded-full ring-4 ring-[#E5B045]/30 shadow-lg mb-3"
          />
          <h1
            className="text-3xl font-black text-[#1A0B3D]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Create your account
          </h1>
          <p className="text-sm text-[#1A0B3D]/60 mt-1">
            Start rehearsing your defence today.
          </p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
