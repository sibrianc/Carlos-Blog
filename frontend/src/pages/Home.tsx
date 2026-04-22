import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HomeTransmutation } from '../components/HomeTransmutation';
import type { SteadyAnchorHandle } from '../portfolio/transmutation/types';
import { api } from '../lib/api';
import type { ProjectSummary } from '../types';

const HERO_CONTENT = {
  kicker: 'Volume I: The Inscription',
  headline: 'Words breathe within the deep quiet of the digital void.',
  body: 'This is a living artifact. A repository of fragments, chronologies, and whispered truths etched into the ether. We do not publish; we inscribe.',
};

export function Home() {
  const navigate = useNavigate();
  const stageRef = useRef<SteadyAnchorHandle>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    api.fetchProjects({ status: 'live' })
      .then((payload) => {
        if (!active) return;
        const featured = payload.projects.filter((p) => p.isFeatured);
        setProjects(featured);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setProjectsLoaded(true);
      });
    return () => { active = false; };
  }, []);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + projects.length) % projects.length);
  }, [projects.length]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % projects.length);
  }, [projects.length]);

  const current = projects[index] || null;
  const layoutSignature = current
    ? `${current.id}:${current.slug}:${current.title}:${current.status}:${current.projectYear}:${current.tagline || current.summary}`
    : 'no-featured';

  const handleProjectNav = useCallback((slug: string) => {
    navigate(`/projects/${slug}`);
  }, [navigate]);

  return (
    <HomeTransmutation
      ref={stageRef}
      hero={HERO_CONTENT}
      layoutSignature={layoutSignature}
      manifestReady={projectsLoaded}
    >
      {current && (
        <section className="home-featured">
          <p className="home-featured-kicker" data-steady-block="home-featured-kicker" data-steady-role="meta">
            // Selected Builds
          </p>

          <div className="home-carousel">
            {projects.length > 1 && (
              <button
                type="button"
                aria-label="Previous project"
                onClick={prev}
                className="carousel-arrow carousel-arrow-prev"
              >
                <span className="neon-arrow">{'<'}</span>
              </button>
            )}

            <Link
              to={`/projects/${current.slug}`}
              className="home-archival-plate"
              data-surface-id={`home-featured-${current.id}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                handleProjectNav(current.slug);
              }}
            >
              <div className="plate-media">
                {current.videoUrl ? (
                  <video autoPlay muted loop playsInline poster={current.coverImage || undefined}>
                    <source src={current.videoUrl} type="video/mp4" />
                  </video>
                ) : current.coverImage ? (
                  <img src={current.coverImage} alt={current.title} />
                ) : (
                  <div className="plate-placeholder">
                    <span className="material-symbols-outlined">terminal</span>
                  </div>
                )}
              </div>
              <div className="plate-inscription">
                <span className="plate-stamp" data-steady-block={`home-featured-${current.id}-stamp`} data-steady-role="meta">
                  {(current.status || 'live').toUpperCase()}
                  {current.projectYear ? ` / ${current.projectYear}` : ''}
                </span>
                <h2 className="plate-title" data-steady-block={`home-featured-${current.id}-title`} data-steady-role="title">
                  {current.title}
                </h2>
                <p className="plate-note" data-steady-block={`home-featured-${current.id}-note`} data-steady-role="body">
                  {current.tagline || current.summary}
                </p>
              </div>
            </Link>

            {projects.length > 1 && (
              <button
                type="button"
                aria-label="Next project"
                onClick={next}
                className="carousel-arrow carousel-arrow-next"
              >
                <span className="neon-arrow">{'>'}</span>
              </button>
            )}
          </div>

          {projects.length > 1 && (
            <div className="carousel-dots">
              {projects.map((p, dotIndex) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`Go to ${p.title}`}
                  className={`carousel-dot ${dotIndex === index ? 'is-active' : ''}`}
                  onClick={() => setIndex(dotIndex)}
                />
              ))}
            </div>
          )}

          <div className="home-featured-cta">
            <Link to="/projects" className="portfolio-link">View All Projects -&gt;</Link>
          </div>
        </section>
      )}
    </HomeTransmutation>
  );
}
