 "use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "dlc-radar-web:v1";

function loadState() {
  if (typeof window === "undefined") {
    return { games: [], events: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { games: [], events: [] };
    }

    const parsed = JSON.parse(raw);
    return {
      games: Array.isArray(parsed.games) ? parsed.games : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return { games: [], events: [] };
  }
}

function saveState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(value) {
  if (!value) return "nunca";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [games, setGames] = useState([]);
  const [events, setEvents] = useState([]);

  const [query, setQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("idle");
  const [searchResults, setSearchResults] = useState([]);
  const [message, setMessage] = useState("");
  const [checkingAppId, setCheckingAppId] = useState(null);

  useEffect(() => {
    const initial = loadState();
    setGames(initial.games);
    setEvents(initial.events);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveState({ games, events });
    }
  }, [games, events, mounted]);

  const unreadEvents = useMemo(
    () => events.filter((event) => !event.read).length,
    [events]
  );

  async function searchGames(event) {
    event.preventDefault();

    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setMessage("");
    setSearchStatus("loading");
    setSearchResults([]);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(cleanQuery)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao buscar jogos.");
      }

      setSearchResults(payload.results || []);
      setSearchStatus("done");
    } catch (error) {
      setSearchStatus("error");
      setMessage(error.message || "Erro ao buscar jogos.");
    }
  }

  function addGame(result) {
    const exists = games.some((game) => game.appid === result.appid);

    if (exists) {
      setMessage(`${result.name} já está no seu radar.`);
      return;
    }

    const newGame = {
      appid: result.appid,
      name: result.name,
      tinyImage: result.tinyImage || null,
      dlcs: [],
      addedAt: new Date().toISOString(),
      lastCheckedAt: null,
      truncated: false,
      totalDlcIds: 0,
    };

    setGames((current) => [newGame, ...current]);
    setSearchResults([]);
    setQuery("");
    setMessage(`${result.name} foi adicionado ao seu radar.`);
  }

  function removeGame(appid) {
    const game = games.find((item) => item.appid === appid);
    if (!game) return;

    const confirmed = window.confirm(`Remover ${game.name} do seu radar?`);
    if (!confirmed) return;

    setGames((current) => current.filter((item) => item.appid !== appid));
    setEvents((current) => current.filter((event) => event.parentAppid !== appid));
    setMessage(`${game.name} foi removido.`);
  }

  async function checkGame(appid) {
    const currentGame = games.find((item) => item.appid === appid);
    if (!currentGame) return;

    setCheckingAppId(appid);
    setMessage("");

    try {
      const response = await fetch(`/api/dlc?appid=${appid}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Erro ao consultar DLCs.");
      }

      const oldDlcIds = new Set((currentGame.dlcs || []).map((dlc) => Number(dlc.appid)));
      const incomingDlcs = payload.dlcs || [];
      const newDlcs = incomingDlcs.filter((dlc) => !oldDlcIds.has(Number(dlc.appid)));

      const checkedAt = payload.checkedAt || new Date().toISOString();

      setGames((current) =>
        current.map((game) => {
          if (game.appid !== appid) return game;

          return {
            ...game,
            name: payload.game?.name || game.name,
            headerImage: payload.game?.headerImage || game.headerImage || null,
            steamUrl: payload.game?.steamUrl || game.steamUrl || null,
            dlcs: incomingDlcs,
            lastCheckedAt: checkedAt,
            truncated: Boolean(payload.truncated),
            totalDlcIds: payload.totalDlcIds || incomingDlcs.length,
          };
        })
      );

      if (newDlcs.length > 0 && currentGame.lastCheckedAt) {
        const newEvents = newDlcs.map((dlc) => ({
          id: `${appid}-${dlc.appid}-${Date.now()}`,
          parentAppid: appid,
          gameName: currentGame.name,
          dlcAppid: dlc.appid,
          dlcName: dlc.name,
          steamUrl: dlc.steamUrl,
          createdAt: checkedAt,
          read: false,
        }));

        setEvents((current) => [...newEvents, ...current].slice(0, 200));
        setMessage(`${newDlcs.length} novidade(s) detectada(s) para ${currentGame.name}.`);
      } else if (newDlcs.length > 0) {
        setMessage(`${currentGame.name} foi checado. ${newDlcs.length} DLC(s) conhecida(s) salva(s).`);
      } else {
        setMessage(`Nenhuma DLC nova detectada para ${currentGame.name}.`);
      }
    } catch (error) {
      setMessage(error.message || "Erro ao checar jogo.");
    } finally {
      setCheckingAppId(null);
    }
  }

  async function checkAll() {
    for (const game of games) {
      // Checagem sequencial para não exagerar nas chamadas.
      await checkGame(game.appid);
    }
  }

  function markEventsRead() {
    setEvents((current) => current.map((event) => ({ ...event, read: true })));
  }

  function exportData() {
    downloadJson("dlc-radar-backup.json", {
      exportedAt: new Date().toISOString(),
      games,
      events,
    });
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        setGames(Array.isArray(parsed.games) ? parsed.games : []);
        setEvents(Array.isArray(parsed.events) ? parsed.events : []);
        setMessage("Backup importado com sucesso.");
      } catch {
        setMessage("Não consegui importar esse arquivo.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  if (!mounted) {
    return null;
  }

  return (
    <main>
      <header className="hero">
        <nav className="topbar">
          <strong>DLC Radar</strong>
          <span>Steam DLC Tracker</span>
        </nav>

        <section className="heroContent">
          <div>
            <p className="eyebrow">lista salva só no seu navegador</p>
            <h1>Siga jogos base e descubra novas DLCs.</h1>
            <p>
              Pesquise um jogo da Steam, adicione ao seu radar e cheque quando
              quiser. O site compara as DLCs atuais com o que estava salvo
              localmente para você.
            </p>
          </div>

          <div className="heroCard">
            <span>{games.length}</span>
            <p>jogos acompanhados</p>
            <span>{unreadEvents}</span>
            <p>novidades não lidas</p>
          </div>
        </section>
      </header>

      <section className="shell">
        {message ? <div className="toast">{message}</div> : null}

        <section className="panel">
          <form className="search" onSubmit={searchGames}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busque um jogo. Ex.: Elden Ring, Cyberpunk, The Sims"
            />
            <button type="submit" disabled={searchStatus === "loading"}>
              {searchStatus === "loading" ? "Buscando..." : "Buscar"}
            </button>
          </form>

          {searchResults.length > 0 ? (
            <div className="results">
              {searchResults.map((result) => (
                <article className="result" key={result.appid}>
                  <div>
                    {result.tinyImage ? <img src={result.tinyImage} alt="" /> : null}
                  </div>
                  <div>
                    <strong>{result.name}</strong>
                    <p>AppID {result.appid}</p>
                  </div>
                  <button type="button" onClick={() => addGame(result)}>
                    Acompanhar
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="toolbar">
          <button type="button" onClick={checkAll} disabled={games.length === 0 || checkingAppId !== null}>
            Checar todos
          </button>
          <button type="button" onClick={exportData}>
            Exportar backup
          </button>
          <label className="fileButton">
            Importar backup
            <input type="file" accept="application/json" onChange={importData} />
          </label>
          <button type="button" onClick={markEventsRead}>
            Marcar novidades como lidas
          </button>
        </section>

        <section className="grid">
          <div className="panel">
            <h2>Meus jogos</h2>

            {games.length === 0 ? (
              <p className="muted">
                Você ainda não acompanha nenhum jogo. Busque um jogo acima para começar.
              </p>
            ) : (
              <div className="cards">
                {games.map((game) => (
                  <article className="gameCard" key={game.appid}>
                    {game.headerImage ? (
                      <img className="cover" src={game.headerImage} alt="" />
                    ) : null}

                    <div className="gameContent">
                      <div>
                        <h3>{game.name}</h3>
                        <p>
                          AppID {game.appid} · DLCs salvas: {(game.dlcs || []).length}
                          {game.truncated ? ` de ${game.totalDlcIds}` : ""}
                        </p>
                        <p>Última checagem: {formatDate(game.lastCheckedAt)}</p>
                      </div>

                      <div className="gameActions">
                        <button
                          type="button"
                          onClick={() => checkGame(game.appid)}
                          disabled={checkingAppId === game.appid}
                        >
                          {checkingAppId === game.appid ? "Checando..." : "Checar"}
                        </button>
                        <button type="button" className="ghost" onClick={() => removeGame(game.appid)}>
                          Remover
                        </button>
                      </div>

                      {(game.dlcs || []).length > 0 ? (
                        <details>
                          <summary>Ver DLCs conhecidas</summary>
                          <div className="dlcList">
                            {game.dlcs.map((dlc) => (
                              <a
                                key={dlc.appid}
                                href={dlc.steamUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="dlcItem"
                              >
                                <span>{dlc.name}</span>
                                <small>
                                  {dlc.releaseDate || "sem data"}
                                  {dlc.price ? ` · ${dlc.price}` : ""}
                                  {dlc.isFree ? " · grátis" : ""}
                                </small>
                              </a>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="panel">
            <h2>Novidades</h2>

            {events.length === 0 ? (
              <p className="muted">Nenhuma DLC nova detectada ainda.</p>
            ) : (
              <div className="eventList">
                {events.slice(0, 25).map((event) => (
                  <a
                    key={event.id}
                    href={event.steamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`event ${event.read ? "" : "unread"}`}
                  >
                    <strong>{event.dlcName}</strong>
                    <span>{event.gameName}</span>
                    <small>{formatDate(event.createdAt)}</small>
                  </a>
                ))}
              </div>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}
