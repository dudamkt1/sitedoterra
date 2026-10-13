"use client";

import { useEffect, useState } from "react";
import "@/app/globals.css";

type LandpageData = {
  site_name: string;
  slogan: string;
  benefits: Array<{ title: string; desc: string; icon: string }>;
  social_proof: Array<{ name: string; text: string }>;
  cta_text: string;
  cta_href: string;
  checkout_text: string;
};

const DEFAULT_LANDING: LandpageData = {
  site_name: "TopConsultores",
  slogan: "Sites profissionais para consultoras doTERRA",
  benefits: [
    { title: "Site Profissional", desc: "Design elegante e moderno.", icon: "🏪" },
    { title: "IA Especialista doTERRA", desc: "Assistente inteligente.", icon: "🤖" },
  ],
  social_proof: [
    { name: "Márcia R.", text: "Site incrível!" },
  ],
  cta_text: "Quero meu site profissional",
  cta_href: "/checkout",
  checkout_text: "Acessar Checkout",
};

export default function Landpage() {
  const [data, setData] = useState(DEFAULT_LANDING);

  useEffect(() => {
    setData(DEFAULT_LANDING);
  }, []);

  const { site_name, slogan, benefits, social_proof, cta_text, cta_href, checkout_text } = data;

  return (
    <div style={{ background: "#fefcf8" }}>
      <h1>{slogan}</h1>
      <p>{site_name}</p>
      <button className="btn btn-primary">{checkout_text}</button>
      <div>Hero section test</div>
      <section>
        <h2>Benefits</h2>
        {benefits.map((b) => (
          <div key={b.icon}>{b.title}: {b.desc}</div>
        ))}
      </section>
      <section>
        <h2>Social Proof</h2>
        {social_proof.map((s) => (
          <div key={s.name}>- {s.name}: {s.text}</div>
        ))}
      </section>
      <footer>
        <p>{site_name} 2024</p>
      </footer>
    </div>
  );
}
