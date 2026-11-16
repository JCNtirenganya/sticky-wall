/* Tiny translation layer shared by the presenter board and the phone page.
   English is the source language: the key IS the English text, so adding a
   string needs no English entry. Only French is stored.

   Usage
     t("Live notes")                       → translated string
     t("{n} notes", { n: 4 })              → translated with placeholders
     <span data-i18n="Live notes"></span>  → translated on load
     data-i18n-placeholder / -title / -aria / -alt for attributes

   Changing language stores the choice and reloads, so every dynamically
   rendered string (dashboard, status bar) is rebuilt in the new
   language without chasing stale nodes. */

(function () {
  const STORAGE_KEY = "sticky_lang";
  const LANGS = {
    en: { name: "English", short: "EN", html: "en" },
    fr: { name: "Français", short: "FR", html: "fr" }
  };

  const DICT = {
    fr: {
      /* ── shared ─────────────────────────────────────────────── */
      "Board": "Tableau",
      "{title} · Board": "{title} · Tableau",
      "Language": "Langue",
      "English": "Anglais",
      "Français": "Français",
      "Sticky note": "Note adhésive",
      "{label} by {author}: {text}": "{label} par {author} : {text}",

      /* ── phone · name ───────────────────────────────────────── */
      "Before we start": "Avant de commencer",
      "What should we call you?": "Comment devons-nous vous appeler ?",
      "A name or nickname": "Un nom ou un surnom",
      "Continue": "Continuer",
      "Your name appears with your note on the wall.": "Votre nom apparaît avec votre note sur le mur.",

      /* ── phone · categories ─────────────────────────────────── */
      "New note": "Nouvelle note",
      "What’s on your mind?": "À quoi pensez-vous ?",
      "Pick a colour, then write.": "Choisissez une couleur, puis écrivez.",
      "Live polls": "Sondages en direct",
      "Tap to answer": "Touchez pour répondre",
      "Note categories": "Catégories de notes",
      "Demo mode · notes stay in this browser": "Mode démo · les notes restent dans ce navigateur",
      "Posting as {name} · change": "Publication en tant que {name} · changer",
      "What do you want to do?": "Que voulez-vous faire ?",
      "Pick one to start. You can switch anytime.": "Choisissez-en un pour commencer. Vous pouvez changer à tout moment.",
      "Write a note for the wall.": "Écrivez une note pour le mur.",
      "Share a photo or short video.": "Partagez une photo ou une courte vidéo.",
      "Answer live polls.": "Répondez aux sondages en direct.",
      "Go live from your camera.": "Passez en direct avec votre caméra.",
      "Back to modules": "Retour aux modules",

      /* ── phone · write ──────────────────────────────────────── */
      "Back": "Retour",
      "Your note": "Votre note",
      "Keep it short and sweet.": "Restez bref et efficace.",
      "Stick it on the wall": "Coller sur le mur",
      "Easy! Wait {n}s": "Doucement ! Attendez {n}s",
      "Stuck on the wall!": "Collée sur le mur !",
      "Couldn't send — try again": "Envoi impossible — réessayez",

      /* ── phone · poll list ──────────────────────────────────── */
      "Back to notes": "Retour aux notes",
      "Have your say": "À vous de parler",
      "Open polls": "Sondages ouverts",
      "No polls yet. The presenter will open one soon.": "Aucun sondage pour l'instant. Le présentateur en ouvrira bientôt un.",

      /* ── phone · one poll ───────────────────────────────────── */
      "Back to polls": "Retour aux sondages",
      "Send answer": "Envoyer la réponse",
      "Sending…": "Envoi…",
      "Update my answer": "Modifier ma réponse",
      "✓ Answered": "✓ Répondu",
      "answered": "répondu",
      "1 response": "1 réponse",
      "{n} responses": "{n} réponses",
      "{n} live polls": "{n} sondages en direct",
      "Polls are closed": "Les sondages sont fermés",
      "Tap to see the results": "Touchez pour voir les résultats",
      "1 waiting for your answer": "1 attend votre réponse",
      "{n} waiting for your answers": "{n} attendent vos réponses",
      "You answered · tap to update": "Vous avez répondu · touchez pour modifier",
      "Pick up to {n}": "Choisissez jusqu'à {n}",
      "This poll is closed. Answers are locked.": "Ce sondage est fermé. Les réponses sont verrouillées.",
      "This poll is not open yet.": "Ce sondage n'est pas encore ouvert.",
      "Write a short answer…": "Écrivez une réponse courte…",
      "Your answer": "Votre réponse",
      "{n} out of 5": "{n} sur 5",
      "{n} of 5": "{n} sur 5",
      "Tap a star to rate": "Touchez une étoile pour noter",
      "Choose up to {n} · {m} selected": "Choisissez jusqu'à {n} · {m} sélectionné(s)",
      "No answers yet. Yours can be the first.": "Aucune réponse pour l'instant. La vôtre peut être la première.",
      "Anonymous": "Anonyme",
      " · you": " · vous",
      "+ {n} more answers": "+ {n} autres réponses",
      "Live results": "Résultats en direct",
      "Share": "Partager",
      "Share & embed": "Partager et intégrer",
      "Live wall link": "Lien du mur en direct",
      "Poll results link": "Lien des résultats",
      "Live results link": "Lien des résultats en direct",
      "Anyone with this link or embed sees the results update live.": "Toute personne avec ce lien ou cet intégré voit les résultats se mettre à jour en direct.",
      "Link": "Lien",
      "Embed code": "Code d'intégration",
      "Copy": "Copier",
      "Copied": "Copié",
      "Open preview": "Aperçu",
      "Done": "Terminé",
      "Live link": "Lien direct",
      "Updates live": "Mise à jour en direct",
      "Offline": "Hors ligne",
      "Waiting for the first note…": "En attente de la première note…",
      "Waiting for the first poll…": "En attente du premier sondage…",
      "Could not load live results.": "Impossible de charger les résultats en direct.",
      "This poll is closed. Thanks for taking part.": "Ce sondage est fermé. Merci de votre participation.",
      "The presenter has not opened this poll yet.": "Le présentateur n'a pas encore ouvert ce sondage.",
      "The presenter will share the results with the room.": "Le présentateur partagera les résultats avec la salle.",
      "Send your answer to unlock the live results.": "Envoyez votre réponse pour débloquer les résultats en direct.",
      "You can update your answer until the poll closes.": "Vous pouvez modifier votre réponse jusqu'à la fermeture du sondage.",
      "Choose an answer first": "Choisissez d'abord une réponse",
      "Answer updated": "Réponse mise à jour",
      "Answer sent": "Réponse envoyée",

      /* ── board · empty ──────────────────────────────────────── */
      "The wall is waiting.": "Le mur vous attend.",
      "Notes land here the moment someone sends one. Scan the QR code or open the link to add the first note.": "Les notes arrivent ici dès qu'elles sont envoyées. Scannez le QR code ou ouvrez le lien pour ajouter la première note.",
      "drop sample notes": "ajouter des notes d'exemple",
      "name this wall": "nommer ce mur",
      "edit categories": "modifier les catégories",
      "poll room": "salle des sondages",

      /* ── board · dashboard ──────────────────────────────────── */
      "Presenter dashboard": "Tableau de bord du présentateur",
      "Presenter · received notes": "Présentateur · notes reçues",
      "You received 0 notes.": "Vous avez reçu 0 note.",
      "You received 1 note.": "Vous avez reçu 1 note.",
      "You received {n} notes.": "Vous avez reçu {n} notes.",
      "Everything received is on the wall.": "Tout ce qui a été reçu est sur le mur.",
      "{alive} on the wall · {hidden} hidden. Restore anything you want back.": "{alive} sur le mur · {hidden} masquée(s). Restaurez ce que vous voulez.",
      "{n} on the wall": "{n} sur le mur",
      " · {n} hidden": " · {n} masquée(s)",
      "Restore": "Restaurer",
      "Hide": "Masquer",
      "Restore {n} hidden": "Restaurer {n} masquée(s)",
      "Notes": "Notes",
      "D or Esc returns to the wall · hidden notes stay here until restored": "D ou Échap revient au mur · les notes masquées restent ici jusqu'à leur restauration",
      "returns to the wall · hidden notes stay here until restored": "revient au mur · les notes masquées restent ici jusqu'à leur restauration",
      "Notes grouped by category": "Notes groupées par catégorie",
      "Show these notes.": "Afficher ces notes.",
      "Back to the wall": "Retour au mur",

      /* ── board · status ─────────────────────────────────────── */
      "1 note": "1 note",
      "{n} notes": "{n} notes",
      " · grouped": " · groupées",
      "{n} hidden": "{n} masquée(s)",
      "{shown} of {alive}": "{shown} sur {alive}",
      "demo": "démo",
      "live": "en direct",
      "Open the poll room (P)": "Ouvrir la salle des sondages (P)",
      "1 poll": "1 sondage",
      "{n} polls": "{n} sondages",
      "Open the poll room. {n} polls, {m} open.": "Ouvrir la salle des sondages. {n} sondages, {m} ouverts.",

      /* ── board · extras ─────────────────────────────────────── */
      "Board extras": "Options du mur",
      "Presenter controls": "Contrôles du présentateur",
      "Everything in one place. Changes apply immediately.": "Tout au même endroit. Les changements s'appliquent immédiatement.",
      "Defaults": "Par défaut",
      "Advanced": "Avancé",
      "Look": "Apparence",
      "Data": "Données",
      "Close (Esc)": "Fermer (Échap)",
      "Copy a read-only link or iframe. It updates live and needs no login.": "Copiez un lien ou un iframe en lecture seule. Il se met à jour en direct et ne demande aucune connexion.",
      "Polls": "Sondages",
      "Layout": "Disposition",
      "On the wall": "Sur le mur",
      "Wall colour": "Couleur du mur",
      "Logo": "Logo",
      "Dashboard": "Tableau de bord",
      "Reset view": "Réinitialiser la vue",
      "Restore hidden": "Restaurer les masquées",
      "Clear wall": "Vider le mur",
      "Poll room": "Salle des sondages",
      "New poll": "Nouveau sondage",
      "Categories in columns": "Catégories en colonnes",
      "Each category starts its own column when the wall has room": "Chaque catégorie commence sa propre colonne quand le mur a de la place",
      "Note spacing": "Espacement des notes",
      "Header & logo": "En-tête et logo",
      "QR code": "QR code",
      "Note count": "Nombre de notes",
      "Filter bar": "Barre de filtres",
      "Wall colour presets": "Couleurs de mur prédéfinies",
      "Default textured wall": "Mur texturé par défaut",
      "Black wall": "Mur noir",
      "Charcoal wall": "Mur anthracite",
      "Slate blue wall": "Mur bleu ardoise",
      "Deep green wall": "Mur vert profond",
      "Plum wall": "Mur prune",
      "Warm brown wall": "Mur brun chaud",
      "Custom wall colour": "Couleur de mur personnalisée",
      "Custom colour": "Couleur personnalisée",
      "Dashboard colour": "Couleur du tableau de bord",
      "Dashboard colour presets": "Couleurs du tableau de bord prédéfinies",
      "Custom dashboard colour": "Couleur du tableau de bord personnalisée",
      "Default paper": "Papier par défaut",
      "Cream dashboard": "Tableau de bord crème",
      "Peach dashboard": "Tableau de bord pêche",
      "Mint dashboard": "Tableau de bord menthe",
      "Sky dashboard": "Tableau de bord ciel",
      "Charcoal dashboard": "Tableau de bord anthracite",
      "Reset": "Réinitialiser",
      "Background image…": "Image de fond…",
      "Remove image": "Supprimer l'image",
      "…or paste an image URL": "…ou collez une URL d'image",
      "Set": "Définir",
      "Image dim": "Assombrissement de l'image",
      "Change logo…": "Changer le logo…",
      "Default logo": "Logo par défaut",
      "…or paste a logo URL": "…ou collez une URL de logo",
      "Logo size": "Taille du logo",
      "Notes only": "Notes seulement",
      "Show all": "Tout afficher",
      "Extras": "Options",
      "Show or hide presenter controls (H)": "Afficher ou masquer les contrôles du présentateur (H)",

      /* ── board · QR ─────────────────────────────────────────── */
      "Scan to take part": "Scannez pour participer",
      "Open {url}": "Ouvrir {url}",

      /* ── board · poll room ──────────────────────────────────── */
      "Presenter · live audience": "Présentateur · public en direct",
      "No polls yet.": "Aucun sondage pour l'instant.",
      "Close": "Fermer",
      "Filter polls": "Filtrer les sondages",
      "No polls yet": "Aucun sondage",
      "Create a poll and it appears on every phone instantly.": "Créez un sondage et il apparaît instantanément sur tous les téléphones.",
      "Create the first poll": "Créer le premier sondage",
      "P or Esc closes · N creates a poll": "P ou Échap ferme · N crée un sondage",
      "closes": "ferme",
      "creates a poll": "crée un sondage",
      "(copy)": "(copie)",
      "{n} open": "{n} ouverts",
      "No answers yet.": "Aucune réponse pour l'instant.",
      " / 5": " / 5",
      "+ {n} more answers": "+ {n} autres réponses",
      "updated {when}": "mis à jour {when}",
      "just now": "à l'instant",
      "{n}m ago": "il y a {n} min",
      "{n}h ago": "il y a {n} h",
      "Edit": "Modifier",
      "Duplicate": "Dupliquer",
      "Close poll": "Fermer le sondage",
      "Open poll": "Ouvrir le sondage",
      "Reset votes": "Réinitialiser les votes",
      "Delete": "Supprimer",
      "Confirm reset": "Confirmer la réinitialisation",
      "Confirm delete": "Confirmer la suppression",
      "Confirm clear": "Confirmer le vidage",
      "+ {n} more polls": "+ {n} autres sondages",
      "Sample polls": "Sondages d'exemple",
      "Load sample polls": "Charger les sondages d'exemple",
      "loads sample polls": "charge les sondages d'exemple",
      "1 sample poll loaded": "1 sondage d'exemple chargé",
      "{n} sample polls loaded": "{n} sondages d'exemple chargés",
      "Could not load sample polls": "Impossible de charger les sondages d'exemple",
      "Could not load sample notes": "Impossible de charger les notes d'exemple",
      "Sample polls are only available in demo mode": "Les sondages d'exemple ne sont disponibles qu'en mode démo",
      "Demo data": "Données de démo",
      "Add sample notes": "Ajouter des notes d'exemple",
      "Add sample polls": "Ajouter des sondages d'exemple",
      "Add 12 more sample notes (S)": "Ajouter 12 notes d'exemple (S)",
      "Add another set of sample polls (S)": "Ajouter une autre série de sondages d'exemple (S)",
      "Reset sample polls": "Réinitialiser les sondages d'exemple",
      "Replace all sample polls with one fresh set": "Remplacer tous les sondages d'exemple par une série neuve",
      "More samples": "Plus d'exemples",
      "{n} sample notes added": "{n} notes d'exemple ajoutées",
      "{n} more sample polls added": "{n} sondages d'exemple supplémentaires ajoutés",
      "Select a word, then paste a link to embed it.": "Sélectionnez un mot, puis collez un lien pour l'intégrer.",
      "Link embedded": "Lien intégré",
      "That link is too long for this note": "Ce lien est trop long pour cette note",
      "Present": "Présenter",
      "Present results": "Présenter les résultats",
      "presents full screen": "présente en plein écran",
      "Present the results full screen (F)": "Présenter les résultats en plein écran (F)",
      "One by one": "Une par une",
      "Present one by one": "Présenter une par une",
      "Present the results one by one (O)": "Présenter les résultats une par une (O)",
      "Manual": "Manuel",
      "No auto": "Sans auto",
      "Present without autoplay (M)": "Présenter sans lecture automatique (M)",
      "Show the notes without autoplay (M)": "Afficher les notes sans lecture automatique (M)",
      "Presentation": "Présentation",
      "Autoplay in full screen": "Lecture automatique en plein écran",
      "Start after": "Démarrer après",
      "Seconds per slide": "Secondes par diapositive",

      /* ── board · poll editor ────────────────────────────────── */
      "Presenter": "Présentateur",
      "Edit poll": "Modifier le sondage",
      "Only you can change the question, options and settings. Phones can only answer.": "Vous seul pouvez modifier la question, les options et les réglages. Les téléphones peuvent seulement répondre.",
      "Question": "Question",
      "e.g. Which topic should we cover next?": "ex. Quel sujet aborder ensuite ?",
      "Description": "Description",
      "optional": "facultatif",
      "A little context for the room…": "Un peu de contexte pour la salle…",
      "Type": "Type",
      "Category": "Catégorie",
      "Options": "Options",
      "+ Add option": "+ Ajouter une option",
      "Max choices": "Choix maximum",
      "Status": "Statut",
      "Results on phones": "Résultats sur les téléphones",
      "Cancel": "Annuler",
      "Save poll": "Enregistrer le sondage",
      "Save changes": "Enregistrer les modifications",
      "Create poll": "Créer le sondage",
      "Option": "Option",
      "Option {n}": "Option {n}",
      "Remove option": "Supprimer l'option",
      "Remove this option": "Supprimer cette option",
      "Maximum {n} options": "Maximum {n} options",
      "Add at least two options": "Ajoutez au moins deux options",
      "Poll option": "Option du sondage",
      "Poll could not be saved": "Le sondage n'a pas pu être enregistré",
      "Poll is live on phones": "Le sondage est en direct sur les téléphones",
      "Poll closed": "Sondage fermé",
      "Poll duplicated as a draft": "Sondage dupliqué en brouillon",
      "Votes cleared": "Votes effacés",
      "Could not clear votes": "Impossible d'effacer les votes",
      "Poll deleted": "Sondage supprimé",
      "Could not delete poll": "Impossible de supprimer le sondage",

      /* ── poll model ─────────────────────────────────────────── */
      "Single choice": "Choix unique",
      "One answer": "Une réponse",
      "Pick one option": "Choisissez une option",
      "Multiple choice": "Choix multiple",
      "Many answers": "Plusieurs réponses",
      "Pick one or more options": "Choisissez une ou plusieurs options",
      "Yes / No": "Oui / Non",
      "Yes or no": "Oui ou non",
      "Pick yes or no": "Choisissez oui ou non",
      "Rating": "Note",
      "1–5 rating": "Note de 1 à 5",
      "Rate from 1 to 5": "Notez de 1 à 5",
      "Open response": "Réponse libre",
      "Open text": "Texte libre",
      "Write a short answer": "Écrivez une réponse courte",
      "Draft": "Brouillon",
      "Hidden from phones": "Masqué sur les téléphones",
      "Open": "Ouvert",
      "Accepting answers": "Accepte les réponses",
      "Closed": "Fermé",
      "Answers locked": "Réponses verrouillées",
      "Always": "Toujours",
      "Phones see live results": "Les téléphones voient les résultats en direct",
      "After voting": "Après le vote",
      "Results unlock after an answer": "Les résultats se débloquent après une réponse",
      "Presenter only": "Présentateur uniquement",
      "Phones only see a thank-you": "Les téléphones voient seulement un remerciement",
      "Yes": "Oui",
      "No": "Non",
      "No answer": "Sans réponse",
      "Untitled poll": "Sondage sans titre",
      "Feedback": "Avis",
      "Priorities": "Priorités",
      "Ideas": "Idées",
      "Knowledge": "Connaissances",
      "Logistics": "Logistique",
      "Other": "Autre",
      "All": "Tous",

      /* ── categories ─────────────────────────────────────────── */
      "Question": "Question",
      "Questions": "Questions",
      "Ask a question": "Poser une question",
      "What are you wondering?": "Qu'est-ce qui vous intrigue ?",
      "Idea": "Idée",
      "Give an idea": "Proposer une idée",
      "What if we…": "Et si nous…",
      "Appreciation": "Appréciation",
      "Thanks": "Merci",
      "Share appreciation": "Exprimer sa gratitude",
      "Say thank you…": "Dites merci…",
      "Resource": "Ressource",
      "Resources": "Ressources",
      "Share a resource": "Partager une ressource",
      "A link, tool or reading…": "Un lien, un outil ou une lecture…",
      "Request": "Demande",
      "Requests": "Demandes",
      "Make a request": "Faire une demande",
      "What do you need help with?": "De quelle aide avez-vous besoin ?",
      "Note": "Note",

      /* ── category editor ────────────────────────────────────── */
      "Categories": "Catégories",
      "Add, rename, recolour or remove note types. Removing one moves its notes to the first category.": "Ajoutez, renommez, recolorez ou supprimez des types de notes. Supprimer un type déplace ses notes vers la première catégorie.",
      "+ Add category": "+ Ajouter une catégorie",
      "Use defaults": "Valeurs par défaut",
      "Save": "Enregistrer",
      "Category name": "Nom de la catégorie",
      "Category colour": "Couleur de la catégorie",
      "Category emoji": "Emoji de la catégorie",
      "Remove category": "Supprimer la catégorie",
      "Remove this category": "Supprimer cette catégorie",
      "Maximum {n} categories": "Maximum {n} catégories",
      "New category": "Nouvelle catégorie",
      "Write your note…": "Écrivez votre note…",
      "Categories changed on this screen only": "Catégories modifiées sur cet écran uniquement",

      /* ── event dialog ───────────────────────────────────────── */
      "Name this wall": "Nommer ce mur",
      "Shown large on the board, above the notes.": "Affiché en grand sur le tableau, au-dessus des notes.",
      "Event name": "Nom de l'événement",
      "Subtitle": "Sous-titre",
      "e.g. Sanokip Annual Meeting": "ex. Réunion annuelle Sanokip",
      "e.g. Notes from the room": "ex. Notes de la salle",
      "Edit event name": "Modifier le nom de l'événement",
      "Edit categories and colours": "Modifier les catégories et les couleurs",

      /* ── focus · filters · piles ────────────────────────────── */
      "Filter notes": "Filtrer les notes",
      "Previous note": "Note précédente",
      "Next note": "Note suivante",
      "Hide note": "Masquer la note",
      "Hide this note from the wall": "Masquer cette note du mur",
      "close": "fermer",
      "All piles": "Toutes les piles",
      "Open pile": "Ouvrir la pile",
      "note": "note",
      "notes": "notes",
      "Filter: {name} ({n})": "Filtrer : {name} ({n})",
      "{i} of {n}": "{i} sur {n}",

      /* ── status messages ────────────────────────────────────── */
      "Could not read that image": "Impossible de lire cette image",
      "That image is too large to save — try a smaller file.": "Cette image est trop lourde pour être enregistrée — essayez un fichier plus petit.",
      "That logo is too large to save — try a smaller file.": "Ce logo est trop lourd pour être enregistré — essayez un fichier plus petit.",
      "That does not look like an image URL": "Cela ne ressemble pas à une URL d'image",

      /* ── race & media & exports ─────────────────────────────── */
      "Chart race": "Course des barres",
      "Charts": "Graphiques",
      "Chart type": "Type de graphique",
      "Chart style": "Style de graphique",
      "Auto": "Auto",
      "Bars": "Barres",
      "Columns": "Colonnes",
      "Donut": "Anneau",
      "Trend": "Tendance",
      "Word cloud": "Nuage de mots",
      "Hand-drawn": "Dessiné à la main",
      "Standard": "Standard",
      "Presenter · live results": "Animateur · résultats en direct",
      "Live chart race": "Course des barres en direct",
      "Written answers, not a race": "Des réponses écrites, pas une course",
      "This poll collects open answers. The results are shown as a handwritten list.": "Ce sondage recueille des réponses libres. Les résultats s'affichent sous forme de liste manuscrite.",
      "Waiting for the first answer": "En attente de la première réponse",
      "As phones answer, the bars will start moving.": "Au fil des réponses, les barres commencent à bouger.",
      "Live": "En direct",
      "Pause": "Pause",
      "Play": "Lire",
      "Replay": "Rejouer",
      "Race progress": "Progression de la course",
      "Playback speed": "Vitesse de lecture",
      "1 answer": "1 réponse",
      "{n} answers": "{n} réponses",
      "Every answer adds a little ink.": "Chaque réponse ajoute un peu d'encre.",
      "Average {n} out of 5": "Moyenne de {n} sur 5",
      "Add icon or image": "Ajouter une icône ou une image",
      "Option icon or image": "Icône ou image de l'option",
      "Emoji or image URL": "Emoji ou URL d'image",
      "Download": "Télécharger",
      "Wall summary PDF": "Résumé du mur PDF",
      "Notes image JPEG": "Image des notes JPEG",
      "Wall summary": "Résumé du mur",
      "All notes in arrival order": "Toutes les notes dans l'ordre d'arrivée",
      "No notes to show.": "Aucune note à afficher.",
      "Nothing to export yet": "Rien à exporter pour le moment",
      "Preparing image…": "Préparation de l'image…",
      "Image saved": "Image enregistrée",
      "Could not save the image": "Impossible d'enregistrer l'image",
      "Preparing PDF…": "Préparation du PDF…",
      "Save as PDF in the print dialog": "Choisissez Enregistrer au format PDF dans la boîte d'impression",
      "Save as PDF": "Enregistrer au format PDF",

      /* ── event media (photos & short videos) ────────────────── */
      "Media wall": "Mur des médias",
      "Show media wall": "Afficher le mur des médias",
      "Hide media wall": "Masquer le mur des médias",
      "Add 3 sample photos": "Ajouter 3 photos d'exemple",
      "Add sample media": "Ajouter des médias d'exemple",
      "Phones upload here; only this board shows the wall.": "Les téléphones envoient ici ; seul ce mur affiche les médias.",
      "Autoplay videos": "Lecture automatique des vidéos",
      "Mute videos": "Couper le son des vidéos",
      "Loop videos": "Lire les vidéos en boucle",
      "Most recent": "Les plus récentes",
      "items": "éléments",
      "Event media wall": "Mur des médias de l'événement",
      "Presenter · event media": "Animateur · médias de l'événement",
      "Shared moments": "Moments partagés",
      "Hide all": "Tout masquer",
      "Waiting for the first photo or video…": "En attente de la première photo ou vidéo…",
      "Confirm hide all": "Confirmer tout masquer",
      "Shared photo": "Photo partagée",
      "Video": "Vidéo",
      "Photo": "Photo",
      "Guest": "Invité",
      "Remove": "Retirer",
      "Remove from wall": "Retirer du mur",
      "Sure?": "Sûr ?",
      "Removing…": "Suppression…",
      "Could not remove": "Impossible de retirer",
      "1 item": "1 élément",
      "{n} items": "{n} éléments",
      "Sample photo": "Photo d'exemple",
      "Shared from a phone at the event": "Partagée depuis un téléphone lors de l'événement",
      "Sample": "Exemple",
      "Adding…": "Ajout…",
      "Added 3 photos": "3 photos ajoutées",
      "Could not add media": "Impossible d'ajouter les médias",
      "Share a photo or video": "Partagez une photo ou une vidéo",
      "It appears on the big screen, never on phones.": "Elle apparaît sur le grand écran, jamais sur les téléphones.",
      "Event media": "Médias de l'événement",
      "Share a moment": "Partagez un moment",
      "Your photo or short video appears on the big screen. Phones never show the wall.": "Votre photo ou courte vidéo apparaît sur le grand écran. Les téléphones n'affichent jamais le mur.",
      "Choose a photo or video": "Choisissez une photo ou une vidéo",
      "Up to 50 MB · videos up to 15 seconds": "Jusqu'à 50 Mo · vidéos jusqu'à 15 secondes",
      "Preview": "Aperçu",
      "Choose another": "Choisir un autre",
      "Send to the big screen": "Envoyer au grand écran",
      "Too large. Choose a file under 50 MB.": "Fichier trop volumineux. Choisissez un fichier de moins de 50 Mo.",
      "Videos must be 15 seconds or shorter": "Les vidéos doivent durer 15 secondes ou moins",
      "Up to 15 seconds": "Jusqu'à 15 secondes",
      "Could not read this file": "Impossible de lire ce fichier",
      "Sending…": "Envoi…",
      "Sent to the big screen": "Envoyé au grand écran",

      /* ── media capture picker ───────────────────────────────── */
      "or": "ou",
      "Take a photo": "Prendre une photo",
      "Opens your camera app": "Ouvre votre application photo",
      "Record a video": "Enregistrer une vidéo",
      "Up to 15 seconds": "Jusqu'à 15 secondes",
      "Browse photos and videos": "Parcourir les photos et vidéos",
      "Pick a file from this device": "Choisissez un fichier sur cet appareil",
      "Use your camera app's filters, effects or AI editing, then capture or pick the result here.": "Utilisez les filtres, effets ou retouches IA de votre application photo, puis capturez ou choisissez le résultat ici.",

      /* ── media full-screen album ────────────────────────────── */
      "Play full screen": "Lire en plein écran",
      "Exit full screen": "Quitter le plein écran",
      "Full screen": "Plein écran",
      "Full screen (Shift+F)": "Plein écran (Maj+F)",
      "Exit full screen (Shift+F)": "Quitter le plein écran (Maj+F)",
      "Play media full screen": "Lire les médias en plein écran",
      "Play media full screen (F)": "Lire les médias en plein écran (F)",
      "Autoplay": "Lecture auto",
      "Previous": "Précédent",
      "Next": "Suivant",

      /* ── live from a phone ─────────────────────────────────── */
      "Go live from your phone": "Diffusez en direct depuis votre téléphone",
      "Your camera on the event screen, live.": "Votre caméra sur l'écran de l'événement, en direct.",
      "Live from your phone": "En direct depuis votre téléphone",
      "Go live": "Passer en direct",
      "Only the event board sees your camera. Nothing is recorded.": "Seul l'écran de l'événement voit votre caméra. Rien n'est enregistré.",
      "Your camera is off": "Votre caméra est éteinte",
      "Start when you are ready.": "Démarrez quand vous êtes prêt.",
      "Start live": "Démarrer le direct",
      "Stop live": "Arrêter le direct",
      "Flip camera": "Changer de caméra",
      "Mute mic": "Couper le micro",
      "Unmute mic": "Activer le micro",
      "Record a short video instead": "Enregistrer plutôt une courte vidéo",
      "Works when a network blocks live video": "Fonctionne si le réseau bloque la vidéo en direct",
      "Connecting…": "Connexion…",
      "Waiting for the board…": "En attente du tableau…",
      "You're live": "Vous êtes en direct",
      "Reconnecting…": "Reconnexion…",
      "This network may block live video. Record a short video instead?": "Ce réseau peut bloquer la vidéo en direct. Enregistrer plutôt une courte vidéo ?",
      "Live ended": "Direct terminé",
      "Could not start the camera": "Impossible de démarrer la caméra",
      "Live video is not supported here": "La vidéo en direct n'est pas prise en charge ici",
      "Camera off": "Caméra éteinte",
      "Live from phones": "En direct depuis les téléphones",
      "{n} live": "{n} en direct",

      /* ── presenter modules, split, requests, reactions ─────── */
      "Modules": "Modules",
      "Media": "Médias",
      "Poll": "Sondage",
      "Stream": "Direct",
      "Live stream": "Direct",
      "Presenter · modules": "Animateur · modules",
      "Choose a module": "Choisir un module",
      "Choose a module (0)": "Choisir un module (0)",
      "What should fill the screen?": "Que doit remplir l'écran ?",
      "Pick one module to activate. You can split the screen later.": "Choisissez un module à activer. Vous pourrez diviser l'écran ensuite.",
      "Everything the room wrote, on the wall.": "Tout ce que la salle a écrit, sur le mur.",
      "Photos and short videos from phones.": "Photos et courtes vidéos des téléphones.",
      "Live questions and results.": "Questions et résultats en direct.",
      "Approved phone cameras, live.": "Caméras de téléphone autorisées, en direct.",
      "pick a module": "choisissez un module",
      "opens this window": "ouvre cette fenêtre",
      "Module home": "Accueil des modules",
      "Split screen": "Écran divisé",
      "Split screen…": "Écran divisé…",
      "Pick two or more modules to show side by side. Use this when the screen or projector is large enough.": "Choisissez deux modules ou plus à afficher côte à côte. Utilisez ceci si l'écran ou le projecteur est assez grand.",
      "Show split": "Afficher la division",
      "Exit split": "Quitter la division",
      "Choose what fills the screen, or show two or more modules side by side.": "Choisissez ce qui remplit l'écran, ou affichez deux modules ou plus côte à côte.",
      "Pick at least two modules.": "Choisissez au moins deux modules.",
      "Pick a module first": "Choisissez d'abord un module",
      "modules": "modules",

      /* go-live requests */
      "Go-live requests": "Demandes de direct",
      "Only you can allow a phone to go live, and you choose where it appears.": "Vous seul pouvez autoriser un téléphone à passer en direct, et vous choisissez où il apparaît.",
      "No pending requests.": "Aucune demande en attente.",
      "Review live requests": "Examiner les demandes de direct",
      "Review requests": "Examiner les demandes",
      "Asking to go live": "Demande à passer en direct",
      "Place the live window": "Placer la fenêtre du direct",
      "Allow": "Autoriser",
      "Deny": "Refuser",
      "Stream page": "Page du direct",
      "Floating window": "Fenêtre flottante",
      "Split with media": "Division avec les médias",
      "Live approved · {where}": "Direct autorisé · {where}",
      "Live request denied": "Demande de direct refusée",
      "{n} go-live requests": "{n} demandes de direct",
      "{n} live from phones": "{n} en direct depuis les téléphones",
      "No live stream yet": "Aucun direct pour l'instant",
      "When someone asks to go live, approve the request and their camera appears here.": "Quand quelqu'un demande à passer en direct, autorisez la demande et sa caméra apparaît ici.",
      "Open media wall": "Ouvrir le mur des médias",
      "Presenter · live stream": "Animateur · direct",
      "Present the stream full screen (F)": "Afficher le direct en plein écran (F)",
      "Close live window": "Fermer la fenêtre du direct",

      /* reactions */
      "React": "Réagir",
      "Reactions": "Réactions",
      "Wall": "Mur",
      "Reaction wall": "Mur des réactions",
      "Close reactions": "Fermer les réactions",

      /* media presentation timing */
      "Seconds per photo": "Secondes par photo",
      "Video speed": "Vitesse de la vidéo",

      /* phone: request first, then reactions */
      "The presenter must allow your camera before it opens.": "L'animateur doit autoriser votre caméra avant qu'elle ne s'ouvre.",
      "Asking the presenter…": "Demande à l'animateur…",
      "Asking…": "Demande…",
      "Opening the camera…": "Ouverture de la caméra…",
      "The presenter did not allow the camera": "L'animateur n'a pas autorisé la caméra",
      "Request cancelled": "Demande annulée",
      "The request expired. Ask again.": "La demande a expiré. Demandez à nouveau.",
      "Cancel request": "Annuler la demande",
      "Could not switch the camera": "Impossible de changer de caméra",

      /* presenter: passphrase reset */
      "Start fresh": "Repartir à zéro",
      "Clear all submissions": "Effacer toutes les contributions",
      "Deletes every note, poll, vote, and media file for everyone. Needs the presenter passphrase.": "Supprime toutes les notes, sondages, votes et fichiers média pour tout le monde. Nécessite le mot de passe du présentateur.",
      "Clear all submissions?": "Effacer toutes les contributions ?",
      "This permanently deletes every note, poll, vote, and media file. It cannot be undone.": "Cela supprime définitivement toutes les notes, sondages, votes et fichiers média. Action irréversible.",
      "Presenter passphrase": "Mot de passe du présentateur",
      "Delete everything": "Tout supprimer",
      "Enter the presenter passphrase.": "Saisissez le mot de passe du présentateur.",
      "Clearing…": "Suppression…",
      "Wrong passphrase. Try again.": "Mot de passe incorrect. Réessayez.",
      "Too many attempts. Try again later.": "Trop de tentatives. Réessayez plus tard.",
      "Presenter reset is not set up yet.": "La réinitialisation du présentateur n'est pas encore configurée.",
      "Could not clear submissions. Try again.": "Impossible d'effacer les contributions. Réessayez.",
      "All submissions cleared": "Toutes les contributions ont été effacées.",

      /* pre-existing gaps kept in the French table */
      "+ New poll": "+ Nouveau sondage",
      "Edit event name (E)": "Modifier le nom de l'événement (E)",
      "Edit categories and colours (C)": "Modifier les catégories et les couleurs (C)",
      "Hide this note from the wall (X)": "Masquer cette note du mur (X)",

      /* ── dates, module shortcuts, highlights ────────────────── */
      "Settings": "Paramètres",
      "All days": "Tous les jours",
      "Open {module}": "Ouvrir {module}",
      "Highlights": "À retenir",
      "Highlights report": "Rapport des moments forts",
      "Themes, quotes and participation drawn from every note on the wall.": "Thèmes, citations et participation tirés de toutes les notes du mur.",
      "AI summary": "Résumé IA",
      "Local summary": "Résumé local",
      "Themes": "Thèmes",
      "In their words": "Dans leurs mots",
      "Participation": "Participation",
      "Contributors": "Contributeurs",
      "Days": "Jours",
      "Summary": "Résumé",
      "Unknown": "Inconnu",
      "Named contributors": "Contributeurs nommés",
      "Anonymous notes": "Notes anonymes",
      "First note": "Première note",
      "Last note": "Dernière note",
      "Media on the wall": "Médias sur le mur",
      "Notes on the wall": "Notes sur le mur",
      "There are no notes on the wall yet.": "Il n'y a pas encore de notes sur le mur.",
      "One note came in from {people} contributor.": "Une note est arrivée de {people} contributeur.",
      "{n} notes came in from {people} contributors.": "{n} notes sont arrivées de {people} contributeurs.",
      "Most of the writing sits in {theme}.": "L'essentiel des écrits se trouve dans {theme}.",
      "The words that return most often are {words}.": "Les mots qui reviennent le plus souvent sont {words}.",
      "Recurring words: {words}.": "Mots récurrents : {words}.",
      "Quiet, personal notes.": "Des notes discrètes et personnelles.",
      "{span} · written {date}": "{span} · rédigé le {date}",
      "No notes to report yet.": "Aucune note à résumer pour l'instant.",
      "Notes appear here as soon as the wall receives one.": "Les notes apparaissent ici dès que le mur en reçoit une.",
      "Reading the wall…": "Lecture du mur…",
      "Highlights written from the notes on this wall.": "Moments forts rédigés à partir des notes de ce mur.",
      "Local highlights extracted from the notes on this wall.": "Moments forts extraits localement des notes de ce mur.",

      "Mute": "Couper le son",
      "Unmute": "Activer le son"
    }
  };

  function readLang() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return LANGS[value] ? value : "en";
    } catch { return "en"; }
  }

  let current = readLang();

  function t(key, vars) {
    const table = DICT[current] || {};
    let out = table[key];
    if (out == null) out = key;
    if (vars) {
      out = String(out).replace(/\{(\w+)\}/g, (match, name) =>
        vars[name] == null ? match : String(vars[name]));
    }
    return out;
  }

  function lang() { return current; }
  function locale() { return LANGS[current].html; }

  function setLang(code) {
    if (!LANGS[code] || code === current) return false;
    current = code;
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
    location.reload();
    return true;
  }

  const ATTR_MAP = [
    ["data-i18n", "textContent"],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-title", "title"],
    ["data-i18n-aria", "aria-label"],
    ["data-i18n-alt", "alt"]
  ];

  function apply(root) {
    const scope = root || document;
    ATTR_MAP.forEach(([attr, prop]) => {
      scope.querySelectorAll("[" + attr + "]").forEach(el => {
        const value = t(el.getAttribute(attr));
        if (prop === "textContent") el.textContent = value;
        else el.setAttribute(prop, value);
      });
    });
    document.documentElement.lang = LANGS[current].html;
  }

  function mountSwitches() {
    document.querySelectorAll("[data-lang-switch]").forEach(host => {
      host.replaceChildren();
      host.setAttribute("role", "group");
      host.setAttribute("aria-label", t("Language"));
      Object.entries(LANGS).forEach(([code, meta]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lang-btn" + (code === current ? " is-active" : "");
        button.textContent = meta.short;
        button.title = t(meta.name);
        button.setAttribute("aria-label", t(meta.name));
        button.setAttribute("aria-pressed", code === current ? "true" : "false");
        button.addEventListener("click", () => setLang(code));
        host.appendChild(button);
      });
    });
  }

  function init() {
    apply(document);
    mountSwitches();
  }

  window.I18N = {
    LANGS,
    lang,
    locale,
    setLang,
    t,
    apply,
    mountSwitches,
    init
  };
  window.t = t;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
