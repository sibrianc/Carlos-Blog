import { motion } from 'motion/react';
import { CadejoGuardian } from '../components/CadejoGuardian';
import { portfolioAsset } from '../portfolio/assets';

const TECH_STACK = ['Python', 'Flask', 'JavaScript', 'React', 'Three.js', 'PostgreSQL', 'Docker', 'Git', 'AWS'];

export function About() {
  return (
    <div className="manifesto page-frame-wide">
      <CadejoGuardian />
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="manifesto-scroll"
      >
        <img src={portfolioAsset('branding.png')} alt="Carlos Sibrian" className="manifesto-portrait" />
        <h1 className="manifesto-name">Carlos Sibrian</h1>
        <p className="manifesto-role">Full Stack Developer</p>

        <div className="manifesto-body">
          <p>
            Full stack engineer based in El Salvador, focused on building products that live at the intersection of
            craftsmanship and cultural identity. I work across the full stack — Python / Flask on the server, React on
            the client — and I care deeply about the feel of what I ship, not just its correctness.
          </p>
          <p>
            This blog is the living proof of that philosophy: it is simultaneously a publishing platform, a case-study
            archive, and an animation playground. Everything you see — the canvas scenes, the Cadejo, Cipitio, the
            Maya architecture — is hand-coded and deployed as a single artefact.
          </p>
          <p>
            When I am not writing code I am writing prose, exploring Mesoamerican mythology, or quietly building the
            next thing. If something here resonates, the contact route is open.
          </p>
        </div>

        <div className="manifesto-marks">
          <a href="https://www.instagram.com/sibrianc/" target="_blank" rel="noreferrer">Instagram</a>
          <a href="https://github.com/sibrianc" target="_blank" rel="noreferrer">GitHub</a>
          <a href="mailto:tu@email.com">Email</a>
        </div>

        <div className="manifesto-tools">
          <h2>Tools of the Craft</h2>
          <ul>
            {TECH_STACK.map((tech) => <li key={tech}>{tech}</li>)}
          </ul>
        </div>
      </motion.section>
    </div>
  );
}
