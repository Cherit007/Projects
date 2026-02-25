import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

vi.mock("../hooks/useAppwriteSync", () => ({
  useAppwriteSync: () => ({
    isAppwriteEnabled: false,
    isConfigChecked: true,
    isSyncing: false,
    currentTournamentId: null,
    setCurrentTournamentId: vi.fn(),
    sessionState: null,
    loadSessionState: vi.fn(async () => null),
    saveSessionState: vi.fn(),
    clearSessionState: vi.fn(),
    loadFromAppwrite: vi.fn(async () => null),
    saveTournamentToAppwrite: vi.fn(async (payload) => payload),
    deleteTournamentFromAppwrite: vi.fn(async () => true),
    saveRatingsToAppwrite: vi.fn(async (payload) => payload),
    savePlayerDatabaseToAppwrite: vi.fn(async (payload) => payload),
    saveMembersToAppwrite: vi.fn(async (payload) => payload),
    saveTemplatesToAppwrite: vi.fn(async (payload) => payload),
    savePlayerPhotosToAppwrite: vi.fn(async (payload) => payload),
    syncCurrentTournament: vi.fn(async () => null),
  }),
}));

describe("App integration flows", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("allows editing number of teams and validates only on start", async () => {
    const user = userEvent.setup();
    render(<App />);

    const numTeamsInput = screen.getByDisplayValue("3");

    await user.clear(numTeamsInput);
    await user.type(numTeamsInput, "1");
    expect(numTeamsInput).toHaveValue("1");
    await user.type(screen.getByPlaceholderText(/Summer Smash 2024/i), "Validation Cup");
    await user.click(screen.getByRole("button", { name: /Start Tournament/i }));
    expect(await screen.findByText(/Number of teams must be between 3 and 12/i)).toBeInTheDocument();

    await user.clear(numTeamsInput);
    await user.type(numTeamsInput, "99");
    expect(numTeamsInput).toHaveValue("99");
    await user.click(screen.getByRole("button", { name: /Start Tournament/i }));
    expect(await screen.findByText(/Number of teams must be between 3 and 12/i)).toBeInTheDocument();

    await user.clear(numTeamsInput);
    await user.type(numTeamsInput, "7abc");
    expect(numTeamsInput).toHaveValue("7");
    await user.click(screen.getByRole("button", { name: /Start Tournament/i }));
    expect(await screen.findByText(/Enter Team Details/i)).toBeInTheDocument();
  });

  it("runs league flow from setup to first saved result and reset", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText(/Summer Smash 2024/i), "Integration Cup");
    await user.click(screen.getByRole("button", { name: /Start Tournament/i }));
    expect(await screen.findByText(/Enter Team Details/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Generate Tournament/i }));
    expect(await screen.findByText(/LIVE NOW/i)).toBeInTheDocument();

    const liveScoreInputs = screen.getAllByPlaceholderText("0");
    await user.type(liveScoreInputs[0], "21");
    await user.type(liveScoreInputs[1], "15");
    await user.click(screen.getByRole("button", { name: /Submit & Continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/Completed Matches \(1\/3\)/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Delete & New/i }));
    expect(await screen.findByText(/Badminton Tournament/i)).toBeInTheDocument();
  });

  it("records and deletes casual singles match from history", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Record Casual Match/i }));

    const singlesPlayerInputs = screen.getAllByPlaceholderText(/Enter player name/i);
    await user.type(singlesPlayerInputs[0], "Alice");
    await user.type(singlesPlayerInputs[1], "Bob");

    await user.type(screen.getByPlaceholderText("21"), "21");
    await user.type(screen.getByPlaceholderText("18"), "15");

    await user.click(screen.getByRole("button", { name: /Save Match & Update ELO/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Save Match & Update ELO/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Casual Matches/i }));
    expect(await screen.findByText(/Casual Match History/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob/i)).toBeInTheDocument();
    expect(screen.getByText(/Score: 21 - 15/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText(/No casual match history yet/i)).toBeInTheDocument();
    });
  });

  it("records and deletes casual doubles match from history", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Record Casual Match/i }));
    await user.click(screen.getByRole("button", { name: /Doubles/i }));

    const doublesPlayerInputs = screen.getAllByPlaceholderText(/Enter player name/i);
    await user.type(doublesPlayerInputs[0], "Dana");
    await user.type(doublesPlayerInputs[1], "Eli");
    await user.type(doublesPlayerInputs[2], "Finn");
    await user.type(doublesPlayerInputs[3], "Gray");

    await user.type(screen.getByPlaceholderText("21"), "19");
    await user.type(screen.getByPlaceholderText("18"), "21");

    await user.click(screen.getByRole("button", { name: /Save Match & Update ELO/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Save Match & Update ELO/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Casual Matches/i }));
    expect(await screen.findByText(/Casual Match History/i)).toBeInTheDocument();
    expect(screen.getByText(/Dana/i)).toBeInTheDocument();
    expect(screen.getByText(/Eli/i)).toBeInTheDocument();
    expect(screen.getByText(/Finn/i)).toBeInTheDocument();
    expect(screen.getByText(/Gray/i)).toBeInTheDocument();
    expect(screen.getByText(/Score: 19 - 21/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText(/No casual match history yet/i)).toBeInTheDocument();
    });
  });

  it("adds, updates and deletes members before tournament day", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Members/i }));

    const nameInput = screen.getByPlaceholderText(/Member name/i);
    const phoneInput = screen.getByPlaceholderText(/WhatsApp number/i);

    await user.type(nameInput, "Alex Chen");
    await user.type(phoneInput, "+91 98765 43210");
    await user.click(screen.getByRole("button", { name: /Add \/ Update Member/i }));

    expect(await screen.findByText("Alex Chen")).toBeInTheDocument();
    expect(screen.getByText("+91 98765 43210")).toBeInTheDocument();

    await user.clear(nameInput);
    await user.clear(phoneInput);
    await user.type(nameInput, "Alex Chen");
    await user.type(phoneInput, "+91 11111 22222");
    await user.click(screen.getByRole("button", { name: /Add \/ Update Member/i }));

    expect(screen.getByText("+91 11111 22222")).toBeInTheDocument();
    expect(screen.queryByText("+91 98765 43210")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Delete$/i }));
    expect(screen.getByText(/No members added yet/i)).toBeInTheDocument();
  });

  it("creates WhatsApp invitation links from generated fixtures and sends invites", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Members/i }));
    await user.type(screen.getByPlaceholderText(/Member name/i), "Alex Chen");
    await user.type(screen.getByPlaceholderText(/WhatsApp number/i), "+91 98765 43210");
    await user.click(screen.getByRole("button", { name: /Add \/ Update Member/i }));
    await user.click(screen.getByRole("button", { name: "✕" }));

    await user.type(screen.getByPlaceholderText(/Summer Smash 2024/i), "Invite Cup");
    await user.click(screen.getByRole("button", { name: /Start Tournament/i }));
    await user.click(screen.getByRole("button", { name: /Generate Tournament/i }));
    expect(await screen.findByText(/LIVE NOW/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Invite/i }));
    expect(await screen.findByText(/WhatsApp Invitations/i)).toBeInTheDocument();
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();

    const whatsappLink = screen.getByRole("link", { name: /WhatsApp/i });
    expect(whatsappLink.getAttribute("href")).toContain("https://wa.me/919876543210");
    expect(whatsappLink.getAttribute("href")).toContain("Invite%20Cup");

    await user.click(screen.getByRole("button", { name: /Send All/i }));
    expect(windowOpenSpy).toHaveBeenCalled();
  });
});
