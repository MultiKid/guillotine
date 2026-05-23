const STARTING_HAND_SIZE = 5;
const NOBLE_LINE_SIZE = 12;

const nobleCards = [
  noble("marie-antoinette", "Marie Antoinette", 5, "purple"),
  noble("king-louis-xvi", "King Louis XVI", 5, "purple"),
  noble("robespierre", "Robespierre", 4, "purple"),
  noble("general", "General", 4, "red"),
  noble("captain-of-the-guard", "Captain of the Guard", 2, "red"),
  noble("palace-guard", "Palace Guard", 1, "red"),
  noble("duke", "Duke", 3, "purple"),
  noble("countess", "Countess", 2, "purple"),
  noble("bishop", "Bishop", 2, "blue"),
  noble("wealthy-priest", "Wealthy Priest", 1, "blue"),
  noble("bad-nun", "Bad Nun", 3, "blue"),
  noble("tax-collector", "Tax Collector", 2, "green"),
  noble("mayor", "Mayor", 3, "green"),
  noble("sheriff", "Sheriff", 1, "green"),
  noble("hero-of-the-people", "Hero of the People", -3, "gray"),
  noble("the-clown", "The Clown", 0, "gray"),
  noble("fast-noble", "Fast Noble", 2, "purple"),
  noble("lady", "Lady", 2, "purple"),
  noble("lord", "Lord", 2, "purple"),
  noble("innocent-victim", "Innocent Victim", -1, "gray"),
];

const actionCards = [
  action("pushed", "Pushed", "pushed"),
  action("stumble", "Stumble", "stumble"),
  action("trip", "Trip", "trip"),
  action("_tis-a-far-better-thing", "'Tis a Far Better Thing", "tisFarBetterThing", "_tis-a-far-better-thing.jpg"),
  action("ignoble-noble", "Ignoble Noble", "ignobleNoble"),
  action("was-that-my-name", "Was That My Name?", "wasThatMyName"),
  action("l-idiot", "L'Idiot", "lIdiot", "l_idiot.jpg"),
  action("friend-of-the-queen", "Friend of the Queen", "friendOfTheQueen"),
  action("fainting-spell", "Fainting Spell", "faintingSpell"),
  action("public-demand", "Public Demand", "publicDemand"),
  action("bribed-guards", "Bribed Guards", "bribedGuards"),
  action("the-long-walk", "The Long Walk", "theLongWalk"),
  action("after-you", "After You...", "afterYou"),
  action("callous-guards", "Callous Guards", "callousGuards"),
  action("double-feature", "Double Feature", "doubleFeature"),
  action("extra-cart", "Extra Cart", "extraCart"),
  action("lack-of-support", "Lack of Support", "lackOfSupport"),
  action("late-arrival", "Late Arrival", "lateArrival"),
  action("mass-confusion", "Mass Confusion", "massConfusion"),
  action("rat-break", "Rat Break", "ratBreak"),
  action("rush-job", "Rush Job", "rushJob"),
  action("twist-of-fate", "Twist of Fate", "twistOfFate"),
  action("political-influence", "Political Influence", "politicalInfluence"),
  action("civic-pride", "Civic Pride", "civicPride"),
  action("military-might", "Military Might", "militaryMight"),
  action("majesty", "Majesty", "majesty"),
];

const movementActionEffects = {
  pushed: { direction: "forward", maxSpaces: 2, exact: true },
  stumble: { direction: "forward", maxSpaces: 1, exact: true },
  trip: { direction: "backward", maxSpaces: 1, exact: true },
  tisFarBetterThing: { direction: "forward", maxSpaces: 3, exact: true },
  ignobleNoble: { direction: "forward", maxSpaces: 4, exact: true },
  wasThatMyName: { direction: "forward", maxSpaces: 3, exact: false },
  lIdiot: { direction: "forward", maxSpaces: 2, exact: false },
  friendOfTheQueen: { direction: "backward", maxSpaces: 2, exact: false },
  faintingSpell: { direction: "backward", maxSpaces: 3, exact: false },
};

export function createReadOnlyOnlineGameState(roomPlayers) {
  const actionDrawPile = createInstances(actionCards, "action");
  const nobleDrawPile = createInstances(nobleCards, "noble");
  let remainingActions = actionDrawPile;

  const players = roomPlayers.map((roomPlayer) => {
    const hand = remainingActions.slice(0, STARTING_HAND_SIZE);
    remainingActions = remainingActions.slice(STARTING_HAND_SIZE);

    return {
      id: roomPlayer.id,
      name: roomPlayer.name,
      hand,
      handCount: hand.length,
      inFrontActions: [],
      collectedNobles: [],
      skipNextActionTurn: false,
      skipActionThisTurn: false,
      shuffleLineBeforeNextCollection: false,
      score: 0,
    };
  });

  return {
    phase: "playing",
    day: 1,
    maxDays: 3,
    players,
    currentPlayerIndex: 0,
    turnStep: "playActionOptional",
    passScreen: { visible: false },
    turnEffects: { endDayAfterTurn: false },
    turnSummary: { nobleNames: [], pointDelta: 0 },
    pendingChoice: undefined,
    returningFromPrivateChoice: false,
    notice: undefined,
    nobleDeck: {
      drawPile: nobleDrawPile.slice(NOBLE_LINE_SIZE),
      discardPile: [],
    },
    actionDeck: {
      drawPile: remainingActions,
      discardPile: [],
    },
    nobleLine: {
      cards: nobleDrawPile.slice(0, NOBLE_LINE_SIZE),
    },
    log: [
      {
        id: "online-game-started",
        message: `Started an online read-only game for ${roomPlayers.length} players.`,
        day: 1,
      },
    ],
    detailedLog: [],
    playerBriefings: Object.fromEntries(players.map((player) => [player.id, []])),
    gameHistory: [],
    winnerIds: [],
  };
}

export function createPlayerGameView(state, viewerPlayerId) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const viewerPlayer = state.players.find((player) => player.id === viewerPlayerId);

  return {
    phase: state.phase,
    day: state.day,
    maxDays: state.maxDays,
    viewerPlayerId,
    currentPlayerId: currentPlayer?.id,
    isViewerTurn: currentPlayer?.id === viewerPlayerId,
    turnStep: state.turnStep,
    passScreenVisible: state.passScreen.visible,
    turnEffects: state.turnEffects,
    pendingChoice: undefined,
    returningFromPrivateChoice: state.returningFromPrivateChoice,
    notice: state.notice,
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      handCount: player.hand.length,
      inFrontActions: player.inFrontActions,
      collectedNobles: player.collectedNobles,
      skipNextActionTurn: player.skipNextActionTurn,
      skipActionThisTurn: player.skipActionThisTurn,
      shuffleLineBeforeNextCollection: player.shuffleLineBeforeNextCollection,
      score: player.score,
    })),
    viewer: viewerPlayer
      ? {
          id: viewerPlayer.id,
          name: viewerPlayer.name,
          handCount: viewerPlayer.hand.length,
          hand: viewerPlayer.hand,
          inFrontActions: viewerPlayer.inFrontActions,
          collectedNobles: viewerPlayer.collectedNobles,
          skipNextActionTurn: viewerPlayer.skipNextActionTurn,
          skipActionThisTurn: viewerPlayer.skipActionThisTurn,
          shuffleLineBeforeNextCollection: viewerPlayer.shuffleLineBeforeNextCollection,
          score: viewerPlayer.score,
        }
      : undefined,
    nobleLine: state.nobleLine.cards,
    nobleDeck: {
      drawPileCount: state.nobleDeck.drawPile.length,
      discardPile: state.nobleDeck.discardPile,
    },
    actionDeck: {
      drawPileCount: state.actionDeck.drawPile.length,
      discardPile: state.actionDeck.discardPile,
    },
    log: state.log,
    briefingItems: state.playerBriefings[viewerPlayerId] ?? [],
    canUndo: false,
    winnerIds: state.winnerIds,
  };
}

export function takeFrontNoble(state, playerId) {
  if (state.phase !== "playing") {
    return { error: "The game is not currently playing." };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.id !== playerId) {
    return { error: "It is not your turn." };
  }

  if (state.turnStep === "turnComplete") {
    return { error: "You already took a noble. End your turn." };
  }

  const noble = state.nobleLine.cards[0];

  if (!noble) {
    return { error: "There is no noble to take." };
  }

  state.nobleLine.cards = state.nobleLine.cards.slice(1);
  currentPlayer.collectedNobles = [...currentPlayer.collectedNobles, noble];
  currentPlayer.score = calculateBasicScore(currentPlayer);

  const drawnAction = state.actionDeck.drawPile[0];

  if (drawnAction) {
    currentPlayer.hand = [...currentPlayer.hand, drawnAction];
    state.actionDeck.drawPile = state.actionDeck.drawPile.slice(1);
  }

  state.log = [
    ...state.log,
    {
      id: `take-${Date.now()}-${noble.instanceId}`,
      message: `${currentPlayer.name} took ${noble.card.name} for ${noble.card.points} points.`,
      day: state.day,
      playerId: currentPlayer.id,
    },
  ];

  if (state.nobleLine.cards.length === 0) {
    if (state.day >= state.maxDays || state.nobleDeck.drawPile.length === 0) {
      state.phase = "gameEnd";
      const highScore = Math.max(...state.players.map((player) => player.score));
      state.winnerIds = state.players.filter((player) => player.score === highScore).map((player) => player.id);
      state.log = [
        ...state.log,
        {
          id: `game-end-${Date.now()}`,
          message: "The online read-only prototype game ended.",
          day: state.day,
        },
      ];
    } else {
      state.day += 1;
      const nextLine = state.nobleDeck.drawPile.slice(0, NOBLE_LINE_SIZE);
      state.nobleDeck.drawPile = state.nobleDeck.drawPile.slice(NOBLE_LINE_SIZE);
      state.nobleLine.cards = nextLine;
      state.turnStep = "turnComplete";
      state.log = [
        ...state.log,
        {
          id: `day-${state.day}-started-${Date.now()}`,
          message: `Day ${state.day} started.`,
          day: state.day,
        },
      ];
    }
  } else {
    state.turnStep = "turnComplete";
  }

  return { ok: true };
}

export function endTurn(state, playerId) {
  if (state.phase !== "playing") {
    return { error: "The game is not currently playing." };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.id !== playerId) {
    return { error: "It is not your turn." };
  }

  if (state.turnStep !== "turnComplete") {
    return { error: "Take the front noble before ending your turn." };
  }

  advanceTurn(state);
  state.log = [
    ...state.log,
    {
      id: `end-turn-${Date.now()}-${playerId}`,
      message: `${currentPlayer.name} ended their turn.`,
      day: state.day,
      playerId,
    },
  ];

  return { ok: true };
}

export function playActionCard(state, playerId, cardId, target) {
  if (state.phase !== "playing") {
    return { error: "The game is not currently playing." };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.id !== playerId) {
    return { error: "It is not your turn." };
  }

  if (state.turnStep !== "playActionOptional") {
    return { error: "You have already played or skipped your action." };
  }

  const actionIndex = currentPlayer.hand.findIndex((actionCard) => actionCard.instanceId === cardId);
  const actionInstance = currentPlayer.hand[actionIndex];

  if (!actionInstance) {
    return { error: "Action card not found in your hand." };
  }

  const effectKey = actionInstance.card.effectKey;
  const effectResult = applyActionEffect(state, effectKey, target);

  if (effectResult.error) {
    return effectResult;
  }

  currentPlayer.hand = currentPlayer.hand.filter((actionCard) => actionCard.instanceId !== cardId);
  state.actionDeck.discardPile = [...state.actionDeck.discardPile, actionInstance];
  state.turnStep = "takeNobleRequired";
  state.log = [
    ...state.log,
    {
      id: `action-${Date.now()}-${actionInstance.instanceId}`,
      message: `${currentPlayer.name} played ${actionInstance.card.name}. ${effectResult.message}`,
      day: state.day,
      playerId,
    },
  ];

  return { ok: true };
}

function applyActionEffect(state, effectKey, target) {
  const movementEffect = movementActionEffects[effectKey];

  if (movementEffect) {
    return applyMovementEffect(state, movementEffect, target);
  }

  if (effectKey === "publicDemand") {
    if (!target || target.type !== "noble") {
      return { error: "Choose a noble to move to the front." };
    }

    const nobleIndex = state.nobleLine.cards.findIndex((noble) => noble.instanceId === target.instanceId);

    if (nobleIndex < 0) {
      return { error: "That noble is not in line." };
    }

    const [noble] = state.nobleLine.cards.splice(nobleIndex, 1);
    state.nobleLine.cards = [noble, ...state.nobleLine.cards];

    return { message: `${noble.card.name} moved to the front of the line.` };
  }

  if (effectKey === "bribedGuards") {
    const noble = state.nobleLine.cards[0];

    if (!noble) {
      return { error: "There is no front noble to move." };
    }

    state.nobleLine.cards = [...state.nobleLine.cards.slice(1), noble];

    return { message: `${noble.card.name} moved to the end of the line.` };
  }

  if (effectKey === "theLongWalk") {
    state.nobleLine.cards = [...state.nobleLine.cards].reverse();

    return { message: "The noble line was reversed." };
  }

  return { error: "That action card is not implemented online yet." };
}

function applyMovementEffect(state, movementEffect, target) {
  if (!target || target.type !== "move-noble") {
    return { error: "Choose a noble to move." };
  }

  const spaces = Number(target.spaces);

  if (!Number.isInteger(spaces) || spaces < 1 || spaces > movementEffect.maxSpaces) {
    return { error: "That movement distance is not legal." };
  }

  if (movementEffect.exact && spaces !== movementEffect.maxSpaces) {
    return { error: "That card requires the exact movement distance." };
  }

  const nobleIndex = state.nobleLine.cards.findIndex((noble) => noble.instanceId === target.instanceId);

  if (nobleIndex < 0) {
    return { error: "That noble is not in line." };
  }

  const toIndex =
    movementEffect.direction === "forward"
      ? nobleIndex - spaces
      : nobleIndex + spaces;

  if (toIndex < 0 || toIndex >= state.nobleLine.cards.length) {
    return { error: "That noble cannot move that far." };
  }

  const noble = state.nobleLine.cards[nobleIndex];
  const withoutNoble = state.nobleLine.cards.filter((candidate) => candidate.instanceId !== noble.instanceId);
  state.nobleLine.cards = [
    ...withoutNoble.slice(0, toIndex),
    noble,
    ...withoutNoble.slice(toIndex),
  ];

  return {
    message: `${noble.card.name} moved ${movementEffect.direction} ${spaces} ${spaces === 1 ? "space" : "spaces"}.`,
  };
}

function noble(id, name, points, colorCategory) {
  return {
    id,
    name,
    kind: "noble",
    points,
    colorCategory,
    imagePath: `/cards/nobles/${id}.jpg`,
  };
}

function action(id, name, effectKey, imageFileName = `${id}.jpg`) {
  return {
    id,
    name,
    kind: "action",
    effectKey,
    imagePath: `/cards/actions/${imageFileName}`,
  };
}

function createInstances(cards, prefix) {
  return cards.map((card, index) => ({
    instanceId: `${prefix}-${index + 1}-${card.id}`,
    cardId: card.id,
    card,
  }));
}

function advanceTurn(state) {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.turnStep = "playActionOptional";
}

function calculateBasicScore(player) {
  return player.collectedNobles.reduce((score, noble) => score + noble.card.points, 0);
}
