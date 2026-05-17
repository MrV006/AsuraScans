import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Layout } from "../components/Layout";
import { db, auth } from "../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  collectionGroup,
  getCountFromServer,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  Settings,
  Plus,
  LayoutGrid,
  List,
  Users as UsersIcon,
  MessageSquare,
  BarChart2,
  Star,
  BookOpen,
} from "lucide-react";
import { Series } from "../lib/types";

import { ImageUploader } from "../components/ImageUploader";
import { SortableImageList } from "../components/SortableImageList";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

export default function Admin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);

  const [seriesList, setSeriesList] = useState<Series[]>([]);

  // Dashboard state
  const [totalChapters, setTotalChapters] = useState(0);

  // Chapter Management state
  const [selectedSeriesForChapters, setSelectedSeriesForChapters] =
    useState<string>("");
  const [chaptersList, setChaptersList] = useState<any[]>([]);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);

  // User & Comment Management state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [adminsMap, setAdminsMap] = useState<Record<string, boolean>>({});
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [siteGenres, setSiteGenres] = useState<string[]>([]);
  const [newGenreInput, setNewGenreInput] = useState("");

  const [siteSettings, setSiteSettings] = useState({
    maintenanceMode: false,
    aboutText: "",
    twitterUrl: "",
    discordUrl: "",
    githubUrl: "",
    seoKeywords: "",
    seoDescription: ""
  });

  // activeTab
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "series"
    | "chapters"
    | "manage"
    | "manage_chapters"
    | "users"
    | "comments"
    | "taxonomy"
    | "reports"
    | "settings"
  >("dashboard");

  // Auth Forms
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [authError, setAuthError] = useState("");

  const [reportsList, setReportsList] = useState<any[]>([]);

  // Series Form
  const [seriesForm, setSeriesForm] = useState({
    title: "",
    cover: "",
    author: "",
    artist: "",
    synopsis: "",
    genres: "",
    tags: "",
    status: "Ongoing",
    type: "Manhwa",
    isHero: false,
    isFeatured: false,
  });

  // Chapter Form
  const [chapterForm, setChapterForm] = useState({
    seriesId: "",
    number: "",
    title: "",
    images: "",
    publishAt: "",
  });

  useEffect(() => {
    let active = true;
    const checkAdmin = async () => {
      if (user) {
        if (
          user.email === "amirrezaveisi45@gmail.com" ||
          user.email === "Mr.V@admin.com"
        ) {
          if (active) setIsAdmin(true);
        } else {
          try {
            const { getDoc, doc } = await import("firebase/firestore");
            const docSnap = await getDoc(doc(db, "admins", user.uid));
            if (active) setIsAdmin(docSnap.exists());
          } catch (e) {
            if (active) setIsAdmin(false);
          }
        }
      } else {
        if (active) setIsAdmin(false);
      }
      if (active) setCheckingAdmin(false);
    };
    checkAdmin();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      const q = query(collection(db, "series"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, (snap) => {
        setSeriesList(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Series),
        );
      });
      return () => unsub();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      const unsubTaxonomy = onSnapshot(doc(db, "settings", "taxonomy"), (docSnap) => {
        if (docSnap.exists() && docSnap.data().genres) {
          setSiteGenres(docSnap.data().genres);
        } else {
          setSiteGenres([
            "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Isekai", "Magic", "Martial Arts", "Mecha", "Mystery", "Psychological", "Romance", "School Life", "Sci-Fi", "Shoujo", "Shounen", "Slice of Life", "Sports", "Supernatural", "Tragedy"
          ]);
        }
      });
      const unsubSettings = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
        if (docSnap.exists()) {
          setSiteSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      });
      return () => {
        unsubTaxonomy();
        unsubSettings();
      };
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && selectedSeriesForChapters) {
      const chaptersRef = collection(
        db,
        `series/${selectedSeriesForChapters}/chapters`,
      );
      const q = query(chaptersRef, orderBy("number", "desc"));
      const unsub = onSnapshot(q, (snap) => {
        setChaptersList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    } else {
      setChaptersList([]);
    }
  }, [isAdmin, selectedSeriesForChapters]);

  useEffect(() => {
    if (isAdmin) {
      const unsubUsers = onSnapshot(
        query(collection(db, "users"), orderBy("createdAt", "desc")),
        (snap) => {
          setUsersList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
      );
      const unsubAdmins = onSnapshot(collection(db, "admins"), (snap) => {
        const adminMap: Record<string, boolean> = {};
        snap.docs.forEach((d) => {
          adminMap[d.id] = true;
        });
        setAdminsMap(adminMap);
      });
      const unsubComments = onSnapshot(
        query(collection(db, "comments"), orderBy("createdAt", "desc")),
        (snap) => {
          setCommentsList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
      );
      const unsubReports = onSnapshot(
        query(collection(db, "reports"), orderBy("createdAt", "desc")),
        (snap) => {
          setReportsList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
      );

      // Fetch total chapters count
      getCountFromServer(collectionGroup(db, "chapters"))
        .then((snap) => {
          setTotalChapters(snap.data().count);
        })
        .catch((err) => console.error("Error getting chapter count:", err));

      return () => {
        unsubUsers();
        unsubAdmins();
        unsubComments();
        unsubReports();
      };
    }
  }, [isAdmin]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    let email = loginUser;

    // Convert username to email format for Firebase
    if (loginUser === "Mr.V") email = "Mr.V@admin.com";
    else if (!email.includes("@")) email = `${loginUser}@admin.com`;

    try {
      await signInWithEmailAndPassword(auth, email, loginPass);
    } catch (error: any) {
      console.error(error);
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/invalid-credential"
      ) {
        try {
          if (loginUser === "Mr.V" && loginPass === "Amir138484") {
            await createUserWithEmailAndPassword(auth, email, loginPass);
            return;
          }
        } catch (createErr: any) {
          if (createErr.code === "auth/operation-not-allowed") {
            setAuthError(
              'Authentication Error: Please enable "Email/Password" provider in the Firebase Console to use this login method.',
            );
            return;
          }
          setAuthError(createErr.message);
        }
      } else if (error.code === "auth/operation-not-allowed") {
        setAuthError(
          'Authentication Error: Please enable "Email/Password" provider in the Firebase Console (Authentication > Sign-in method).',
        );
      } else {
        setAuthError("Login Failed: " + error.message);
      }
    }
  };

  const handleAddSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const genresArray = seriesForm.genres
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      const tagsArray = seriesForm.tags
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);

      if (editingSeries) {
        const docRef = doc(db, "series", editingSeries.id);
        await setDoc(
          docRef,
          {
            title: seriesForm.title,
            cover: seriesForm.cover,
            banner: seriesForm.cover,
            author: seriesForm.author,
            artist: seriesForm.artist,
            synopsis: seriesForm.synopsis,
            genres: genresArray,
            tags: tagsArray,
            status: seriesForm.status,
            type: seriesForm.type,
            isHero: seriesForm.isHero,
            isFeatured: seriesForm.isFeatured,
            updatedAt: serverTimestamp(),
            // preserve fields
            createdAt: editingSeries.createdAt,
            rating: editingSeries.rating || 5.0,
          },
          { merge: true },
        );
        alert("Series updated successfully!");
        setEditingSeries(null);
      } else {
        const newRef = doc(collection(db, "series"));
        await setDoc(newRef, {
          title: seriesForm.title,
          cover: seriesForm.cover,
          banner: seriesForm.cover,
          author: seriesForm.author,
          artist: seriesForm.artist,
          synopsis: seriesForm.synopsis,
          genres: genresArray,
          tags: tagsArray,
          status: seriesForm.status,
          rating: 5.0,
          type: seriesForm.type,
          isHero: seriesForm.isHero,
          isFeatured: seriesForm.isFeatured,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        alert("Series created successfully!");
      }
      setSeriesForm({
        title: "",
        cover: "",
        author: "",
        artist: "",
        synopsis: "",
        genres: "",
        tags: "",
        status: "Ongoing",
        type: "Manhwa",
        isHero: false,
        isFeatured: false,
      });
    } catch (error: any) {
      alert("Error saving series: " + error.message);
    }
  };

  const handleDeleteSeries = async (id: string, title: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${title}"? This will delete the series and all its chapters.`,
      )
    )
      return;
    try {
      await import("firebase/firestore").then(
        async ({ deleteDoc, getDocs, collection, query }) => {
          // First delete all chapters
          const chaptersRef = collection(db, "series", id, "chapters");
          const q = query(chaptersRef);
          const snapshot = await getDocs(q);
          const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
          await Promise.all(deletePromises);

          // Then delete the series itself
          await deleteDoc(doc(db, "series", id));
        },
      );
      alert("Series and all chapters deleted!");
    } catch (error: any) {
      alert("Error deleting series: " + error.message);
    }
  };

  const handleEditClick = (s: Series) => {
    setEditingSeries(s);
    setSeriesForm({
      title: s.title,
      cover: s.cover,
      author: s.author,
      artist: s.artist,
      synopsis: s.synopsis,
      genres: s.genres.join(", "),
      tags: s.tags?.join(", ") || "",
      status: s.status,
      type: s.type,
      isHero: s.isHero || false,
      isFeatured: s.isFeatured || false,
    });
    setActiveTab("series");
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterForm.seriesId) return alert("Select a series first");
    try {
      const imagesArray = chapterForm.images
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s);

      if (editingChapterId) {
        const docRef = doc(
          db,
          `series/${chapterForm.seriesId}/chapters`,
          editingChapterId,
        );
        await setDoc(
          docRef,
          {
            seriesId: chapterForm.seriesId,
            number: parseFloat(chapterForm.number),
            title: chapterForm.title,
            images: imagesArray,
            publishAt: chapterForm.publishAt || null,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        alert("Chapter updated successfully!");
        setEditingChapterId(null);
      } else {
        const newRef = doc(
          collection(db, `series/${chapterForm.seriesId}/chapters`),
        );
        await setDoc(newRef, {
          seriesId: chapterForm.seriesId,
          number: parseFloat(chapterForm.number),
          title: chapterForm.title,
          images: imagesArray,
          publishAt: chapterForm.publishAt || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Send notifications
        const seriesTitle =
          seriesList.find((s) => s.id === chapterForm.seriesId)?.title ||
          "A bookmarked series";
        const newChapId = newRef.id;
        const chapNum = chapterForm.number;
        const sId = chapterForm.seriesId;

        import("firebase/firestore").then(async ({ getDoc }) => {
          const promises = usersList.map(async (u) => {
            try {
              const bSnap = await getDoc(
                doc(db, `users/${u.id}/bookmarks`, sId),
              );
              if (bSnap.exists()) {
                const notifRef = doc(
                  collection(db, `users/${u.id}/notifications`),
                );
                await setDoc(notifRef, {
                  type: "new_chapter",
                  title: "فصل جدید منتشر شد!",
                  body: `فصل ${chapNum} از کمیک ${seriesTitle} منتشر شد.`,
                  link: `/series/${sId}/chapter/${newChapId}`,
                  createdAt: serverTimestamp(),
                  read: false,
                });
              }
            } catch (err) {
              console.error("Error sending notification to user", u.id, err);
            }
          });
          await Promise.all(promises);
        });

        alert("Chapter created successfully!");
      }
      setChapterForm({
        seriesId: chapterForm.seriesId,
        number: "",
        title: "",
        images: "",
      });
    } catch (error: any) {
      alert("Error saving chapter: " + error.message);
    }
  };

  const handleEditChapterClick = (chapter: any) => {
    setEditingChapterId(chapter.id);
    setChapterForm({
      seriesId: chapter.seriesId,
      number: chapter.number.toString(),
      title: chapter.title || "",
      images: chapter.images.join("\n"),
      publishAt: chapter.publishAt || "",
    });
  };

  const handleDeleteChapter = async (
    seriesId: string,
    chapterId: string,
    number: number,
  ) => {
    if (!window.confirm(`Are you sure you want to delete Chapter ${number}?`))
      return;
    try {
      await import("firebase/firestore").then(async ({ deleteDoc }) => {
        await deleteDoc(doc(db, `series/${seriesId}/chapters`, chapterId));
      });
      alert("Chapter deleted!");
    } catch (error: any) {
      alert("Error deleting chapter: " + error.message);
    }
  };

  const toggleAdmin = async (
    userId: string,
    currentStatus: boolean,
    email?: string,
  ) => {
    if (email === "amirrezaveisi45@gmail.com" || email === "Mr.V@admin.com") {
      alert("Cannot remove primary head admins.");
      return;
    }
    try {
      const { setDoc, deleteDoc } = await import("firebase/firestore");
      if (currentStatus) {
        await deleteDoc(doc(db, "admins", userId));
      } else {
        await setDoc(doc(db, "admins", userId), {
          createdAt: serverTimestamp(),
        });
      }
    } catch (error: any) {
      alert("Failed to toggle admin status: " + error.message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?"))
      return;
    try {
      await import("firebase/firestore").then(async ({ deleteDoc }) => {
        await deleteDoc(doc(db, "comments", commentId));
      });
    } catch (error: any) {
      alert("Failed to delete comment: " + error.message);
    }
  };

  if (loading || checkingAdmin) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-[var(--color-asura-accent)] rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] p-8 rounded-2xl w-full max-w-sm">
            <h2 className="text-2xl font-black text-white uppercase text-center mb-6">
              Admin Login
            </h2>
            <form onSubmit={handleAdminLogin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Username / Email
                  </label>
                  <input
                    required
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[var(--color-asura-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-[var(--color-asura-accent)]"
                  />
                </div>
                {authError && (
                  <div className="text-red-400 text-xs font-bold">
                    {authError}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-bold text-sm uppercase py-3 rounded-lg mt-4 transition-colors"
                >
                  Login via Password
                </button>
              </div>
            </form>
            <div className="mt-6 text-center text-xs text-zinc-500">
              <p>
                If you prefer, login via Google from the Navbar with your
                authorized admin email.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black text-white uppercase flex items-center gap-2 mb-8">
          <Settings className="text-[var(--color-asura-accent)]" /> Admin
          Dashboard
        </h1>

        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "dashboard" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <BarChart2 size={18} /> Dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab("manage");
              setEditingSeries(null);
              setSeriesForm({
                title: "",
                cover: "",
                author: "",
                artist: "",
                synopsis: "",
                genres: "",
                tags: "",
                status: "Ongoing",
                type: "Manhwa",
                isHero: false,
                isFeatured: false,
              });
            }}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "manage" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <List size={18} /> Manage Series
          </button>
          <button
            onClick={() => setActiveTab("series")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "series" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <LayoutGrid size={18} />{" "}
            {editingSeries ? "Edit Series" : "Add Series"}
          </button>
          <button
            onClick={() => setActiveTab("manage_chapters")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "manage_chapters" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <List size={18} /> Manage Chapters
          </button>
          <button
            onClick={() => {
              setActiveTab("chapters");
              setEditingChapterId(null);
              setChapterForm({
                seriesId: "",
                number: "",
                title: "",
                images: "",
              });
            }}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "chapters" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <Plus size={18} />{" "}
            {editingChapterId ? "Edit Chapter" : "Add Chapter"}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "users" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <UsersIcon size={18} /> Users
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "comments" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <MessageSquare size={18} /> Comments
          </button>
          <button
            onClick={() => setActiveTab("taxonomy")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "taxonomy" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <BookOpen size={18} /> Taxonomy
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "reports" ? "bg-red-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <span className="relative">
               Reports
               {reportsList.filter(r => r.status === 'pending').length > 0 && (
                 <span className="absolute -top-3 -right-6 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-lg shadow-red-500/50">
                    {reportsList.filter(r => r.status === 'pending').length}
                 </span>
               )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors ${activeTab === "settings" ? "bg-[var(--color-asura-accent)] text-white" : "bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            <Settings size={18} /> Settings
          </button>
        </div>

        <div className="bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-6 md:p-8 overflow-hidden">
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4">
                Platform Overview
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                  <div className="p-4 bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent)] rounded-lg">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      Total Series
                    </p>
                    <p className="text-3xl font-black text-white">
                      {seriesList.length}
                    </p>
                  </div>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                  <div className="p-4 bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent)] rounded-lg">
                    <List size={24} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      Total Chapters
                    </p>
                    <p className="text-3xl font-black text-white">
                      {totalChapters || "-"}
                    </p>
                  </div>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex items-center gap-4">
                  <div className="p-4 bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent)] rounded-lg">
                    <UsersIcon size={24} />
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      Total Users
                    </p>
                    <p className="text-3xl font-black text-white">
                      {usersList.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div>
                  <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-6">
                    User Growth (Last 7 Days)
                  </h2>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={
                          // Mock growth data based on users array for UI, in a real app this would group by createdAt
                          Array.from({ length: 7 }).map((_, i) => ({
                            name: new Date(
                              Date.now() - (6 - i) * 24 * 60 * 60 * 1000,
                            ).toLocaleDateString("en-US", { weekday: "short" }),
                            users: Math.floor(
                              (usersList.length / 7) * (i + 1) +
                                Math.random() * 10,
                            ),
                          }))
                        }
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#ffffff10"
                        />
                        <XAxis
                          dataKey="name"
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#111",
                            borderColor: "#333",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="users"
                          stroke="var(--color-asura-accent)"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "var(--color-asura-accent)" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-6">
                    Top Series By Views
                  </h2>
                  <div className="bg-black/40 border border-white/10 rounded-xl p-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={seriesList
                          .slice()
                          .sort((a, b) => (b.views || 0) - (a.views || 0))
                          .slice(0, 5)
                          .map((s) => ({
                            name:
                              s.title.slice(0, 20) +
                              (s.title.length > 20 ? "..." : ""),
                            views: s.views || 0,
                          }))}
                        margin={{ left: 50 }}
                      >
                        <XAxis
                          type="number"
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          stroke="#999"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#111",
                            borderColor: "#333",
                          }}
                          cursor={{ fill: "#ffffff05" }}
                        />
                        <Bar
                          dataKey="views"
                          fill="var(--color-asura-accent)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mt-8">
                Most Popular Series
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {seriesList
                  .slice()
                  .sort((a, b) => (b.views || 0) - (a.views || 0))
                  .slice(0, 6)
                  .map((series, idx) => (
                    <div
                      key={series.id}
                      className="bg-black/40 border border-white/10 rounded-xl p-4 flex gap-4 items-center"
                    >
                      <div className="text-3xl font-black text-zinc-800 w-8">
                        {idx + 1}
                      </div>
                      <img
                        src={series.cover}
                        alt={series.title}
                        className="w-16 h-24 object-cover rounded-lg bg-zinc-800 shrink-0"
                      />
                      <div className="flex flex-col">
                        <h3 className="text-white font-bold line-clamp-2">
                          {series.title}
                        </h3>
                        <div className="flex items-center gap-1 text-yellow-500 text-xs mt-2 font-bold">
                          <Star size={12} fill="currentColor" />{" "}
                          {series.rating ? series.rating.toFixed(1) : "N/A"}
                        </div>
                        <p className="text-zinc-500 text-xs mt-1">
                          {series.type} • {series.status}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === "manage" && (
            <div className="overflow-x-auto">
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                Manage Series
              </h2>
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {seriesList.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-white font-medium">
                        <div className="flex items-center gap-3">
                          <img
                            src={s.cover}
                            alt="cover"
                            className="w-8 h-12 object-cover rounded bg-zinc-800"
                          />
                          <span className="line-clamp-1">{s.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{s.status}</td>
                      <td className="py-3 px-4 text-zinc-300">{s.type}</td>
                      <td className="py-3 px-4 text-yellow-500">
                        {s.rating || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEditClick(s)}
                            className="text-[var(--color-asura-accent-light)] hover:text-white font-bold text-xs uppercase tracking-wider transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSeries(s.id, s.title)}
                            className="text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-wider transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {seriesList.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-zinc-500"
                      >
                        No series found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "users" && (
            <div className="overflow-x-auto">
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                Manage Users
              </h2>
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {usersList.map((u) => {
                    const isUserAdmin =
                      adminsMap[u.id] ||
                      u.email === "amirrezaveisi45@gmail.com" ||
                      u.email === "Mr.V@admin.com";
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4 text-white font-medium">
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                u.avatarUrl || "https://via.placeholder.com/40"
                              }
                              alt="avatar"
                              className="w-8 h-8 object-cover rounded-full bg-zinc-800"
                            />
                            <div className="flex flex-col">
                              <span className="line-clamp-1">
                                {u.displayName}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {u.email || u.id}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded ${isUserAdmin ? "bg-[var(--color-asura-accent)]/20 text-[var(--color-asura-accent)]" : "bg-zinc-800 text-zinc-400"}`}
                          >
                            {isUserAdmin ? "Admin" : "User"}
                          </span>
                        </td>
                        <td className="py-3 px-4 flex gap-4">
                          <button
                            onClick={() =>
                              toggleAdmin(u.id, isUserAdmin, u.email)
                            }
                            className={`font-bold text-xs uppercase tracking-wider transition-colors ${isUserAdmin ? "text-red-500 hover:text-red-400" : "text-[var(--color-asura-accent-light)] hover:text-white"}`}
                          >
                            {isUserAdmin ? "Revoke Admin" : "Make Admin"}
                          </button>
                          {!isUserAdmin && (
                            <button
                              onClick={() => {
                                const newBannedStatus = !u.banned;
                                if (!window.confirm(`Are you sure you want to ${newBannedStatus ? 'ban' : 'unban'} this user?`)) return;
                                setDoc(doc(db, 'users', u.id), { banned: newBannedStatus }, { merge: true }).catch(err => alert('Failed to update ban status: ' + err.message));
                              }}
                              className={`font-bold text-xs uppercase tracking-wider transition-colors ${u.banned ? "text-green-500 hover:text-green-400" : "text-red-500 hover:text-red-400"}`}
                            >
                              {u.banned ? "Unban" : "Ban"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {usersList.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-zinc-500"
                      >
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "comments" && (
            <div className="overflow-x-auto">
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                Manage Comments
              </h2>
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Comment</th>
                    <th className="py-3 px-4 w-32">Author</th>
                    <th className="py-3 px-4 w-24">Date</th>
                    <th className="py-3 px-4 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {commentsList.map((c) => {
                    const author = usersList.find((u) => u.id === c.authorId);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <p className="text-zinc-300 text-sm line-clamp-2">
                            {c.content}
                          </p>
                          <div className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-wider">
                            Series:{" "}
                            {seriesList.find((s) => s.id === c.seriesId)
                              ?.title || c.seriesId}
                            {c.chapterId && ` | Chapter: ${c.chapterId}`}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          {author?.displayName || "Unknown"}
                        </td>
                        <td className="py-3 px-4 text-zinc-400 text-xs">
                          {c.createdAt?.toDate
                            ? new Date(
                                c.createdAt.toDate(),
                              ).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-wider transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {commentsList.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-zinc-500"
                      >
                        No comments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "manage_chapters" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h2 className="text-xl font-black text-white uppercase flex items-center gap-2">
                  Manage Chapters
                </h2>
                <div className="w-64">
                  <select
                    value={selectedSeriesForChapters}
                    onChange={(e) =>
                      setSelectedSeriesForChapters(e.target.value)
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">-- Choose Series --</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedSeriesForChapters ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Chapter No.</th>
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4">Pages</th>
                        <th className="py-3 px-4">Views</th>
                        <th className="py-3 px-4">Publish At</th>
                        <th className="py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {chaptersList.map((ch) => (
                        <tr
                          key={ch.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3 px-4 text-white font-medium">
                            Chapter {ch.number}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {ch.title || "-"}
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            {ch.images?.length || 0}
                          </td>
                          <td className="py-3 px-4 flex gap-1 items-center font-bold text-zinc-300">
                            <BarChart2
                              size={14}
                              className="text-[var(--color-asura-accent)]"
                            />{" "}
                            {ch.views || 0}
                          </td>
                          <td className="py-3 px-4 text-zinc-400 text-xs whitespace-nowrap">
                            {ch.publishAt
                              ? new Date(ch.publishAt).toLocaleString()
                              : "Immediate"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  handleEditChapterClick(ch);
                                  setActiveTab("chapters");
                                }}
                                className="text-[var(--color-asura-accent-light)] hover:text-white font-bold text-xs uppercase tracking-wider transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteChapter(
                                    ch.seriesId,
                                    ch.id,
                                    ch.number,
                                  )
                                }
                                className="text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-wider transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {chaptersList.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-8 text-center text-zinc-500"
                          >
                            No chapters found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  Please select a series to view its chapters.
                </div>
              )}
            </div>
          )}

          {activeTab === "series" && (
            <form onSubmit={handleAddSeries} className="space-y-6 max-w-3xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h2 className="text-xl font-black text-white uppercase">
                  {editingSeries ? "Edit Series" : "Create New Series"}
                </h2>
                {editingSeries && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSeries(null);
                      setSeriesForm({
                        title: "",
                        cover: "",
                        author: "",
                        artist: "",
                        synopsis: "",
                        genres: "",
                        tags: "",
                        status: "Ongoing",
                        type: "Manhwa",
                        isHero: false,
                        isFeatured: false,
                      });
                      setActiveTab("manage");
                    }}
                    className="text-xs text-zinc-400 hover:text-white uppercase font-bold tracking-wider"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Title
                  </label>
                  <input
                    required
                    value={seriesForm.title}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, title: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Cover Image URL
                  </label>
                  <div className="flex flex-col gap-3">
                    <input
                      required
                      value={seriesForm.cover}
                      onChange={(e) =>
                        setSeriesForm({ ...seriesForm, cover: e.target.value })
                      }
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                    <ImageUploader
                      onUpload={(urls) =>
                        setSeriesForm({ ...seriesForm, cover: urls[0] })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Author
                  </label>
                  <input
                    required
                    value={seriesForm.author}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, author: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Artist
                  </label>
                  <input
                    required
                    value={seriesForm.artist}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, artist: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Synopsis
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={seriesForm.synopsis}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, synopsis: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Genres
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {siteGenres.map((g) => {
                      const curGenres = seriesForm.genres
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const isSelected = curGenres.includes(g);
                      return (
                        <label
                          key={g}
                          className="flex items-center gap-2 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-sm text-zinc-300 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              let newG = [...curGenres];
                              if (e.target.checked && !newG.includes(g))
                                newG.push(g);
                              else if (!e.target.checked)
                                newG = newG.filter((x) => x !== g);
                              setSeriesForm({
                                ...seriesForm,
                                genres: newG.join(", "),
                              });
                            }}
                            className="form-checkbox text-[var(--color-asura-accent)] bg-black/40 border-white/10 rounded"
                          />
                          {g}
                        </label>
                      );
                    })}
                  </div>
                  <input
                    required
                    value={seriesForm.genres}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, genres: e.target.value })
                    }
                    placeholder="Or type manually (comma separated)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Tags (comma separated)
                  </label>
                  <input
                    value={seriesForm.tags}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, tags: e.target.value })
                    }
                    placeholder="Reincarnation, Magic"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Status
                  </label>
                  <select
                    value={seriesForm.status}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, status: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option>Ongoing</option>
                    <option>Completed</option>
                    <option>Hiatus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Type
                  </label>
                  <select
                    value={seriesForm.type}
                    onChange={(e) =>
                      setSeriesForm({ ...seriesForm, type: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option>Manhwa</option>
                    <option>Manga</option>
                    <option>Manhua</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex items-center gap-6 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seriesForm.isHero}
                      onChange={(e) =>
                        setSeriesForm({
                          ...seriesForm,
                          isHero: e.target.checked,
                        })
                      }
                      className="form-checkbox h-5 w-5 rounded text-[var(--color-asura-accent)] focus:ring-0 bg-black/40 border-white/10"
                    />
                    <span className="text-sm font-bold text-white uppercase">
                      Show in Hero Carousel
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seriesForm.isFeatured}
                      onChange={(e) =>
                        setSeriesForm({
                          ...seriesForm,
                          isFeatured: e.target.checked,
                        })
                      }
                      className="form-checkbox h-5 w-5 rounded text-[var(--color-asura-accent)] focus:ring-0 bg-black/40 border-white/10"
                    />
                    <span className="text-sm font-bold text-white uppercase">
                      Show in Featured / Top
                    </span>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="mt-6 px-8 py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-bold text-sm uppercase rounded-lg shadow-lg"
              >
                {editingSeries ? "Update Series" : "Create Series"}
              </button>
            </form>
          )}

          {activeTab === "chapters" && (
            <form onSubmit={handleAddChapter} className="space-y-6 max-w-3xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h2 className="text-xl font-black text-white uppercase">
                  {editingChapterId ? "Edit Chapter" : "Add Chapter"}
                </h2>
                {editingChapterId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingChapterId(null);
                      setChapterForm({
                        seriesId: chapterForm.seriesId,
                        number: "",
                        title: "",
                        images: "",
                      });
                      setActiveTab("manage_chapters");
                    }}
                    className="text-xs text-zinc-400 hover:text-white uppercase font-bold tracking-wider"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Select Series
                  </label>
                  <select
                    required
                    value={chapterForm.seriesId}
                    onChange={(e) =>
                      setChapterForm({
                        ...chapterForm,
                        seriesId: e.target.value,
                      })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">-- Choose Series --</option>
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Chapter Number
                  </label>
                  <input
                    required
                    type="number"
                    step="0.5"
                    value={chapterForm.number}
                    onChange={(e) =>
                      setChapterForm({ ...chapterForm, number: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Chapter Title (Optional)
                  </label>
                  <input
                    value={chapterForm.title}
                    onChange={(e) =>
                      setChapterForm({ ...chapterForm, title: e.target.value })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Publish At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={chapterForm.publishAt}
                    onChange={(e) =>
                      setChapterForm({
                        ...chapterForm,
                        publishAt: e.target.value,
                      })
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">
                    Image URLs (One per line)
                  </label>
                  <div className="flex flex-col gap-3">
                    <textarea
                      required
                      rows={8}
                      value={chapterForm.images}
                      onChange={(e) =>
                        setChapterForm({
                          ...chapterForm,
                          images: e.target.value,
                        })
                      }
                      placeholder="https://example.com/page1.jpg&#10;https://example.com/page2.jpg"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-[var(--color-asura-accent)]/50 font-mono text-xs"
                    />
                    <ImageUploader
                      multiple
                      onUpload={(urls) =>
                        setChapterForm({
                          ...chapterForm,
                          images: chapterForm.images
                            ? `${chapterForm.images}\n${urls.join("\n")}`
                            : urls.join("\n"),
                        })
                      }
                    />

                    {chapterForm.images.trim().length > 0 && (
                      <SortableImageList
                        images={chapterForm.images
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean)}
                        onChange={(newImages) =>
                          setChapterForm({
                            ...chapterForm,
                            images: newImages.join("\n"),
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="px-8 py-3 flex items-center gap-2 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white font-bold text-sm uppercase rounded-lg shadow-lg"
              >
                <Plus size={18} />{" "}
                {editingChapterId ? "Update Chapter" : "Publish Chapter"}
              </button>
            </form>
          )}

          {activeTab === "taxonomy" && (
            <div>
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                Manage Taxonomy
              </h2>
              <div className="bg-black/20 p-6 rounded-xl border border-white/5 mb-8">
                <h3 className="text-sm font-bold text-white uppercase mb-4">
                  Genres
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {siteGenres.map((genre) => (
                    <div
                      key={genre}
                      className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2"
                    >
                      {genre}
                      <button
                        onClick={() => {
                          const newG = siteGenres.filter((g) => g !== genre);
                          setSiteGenres(newG);
                          setDoc(
                            doc(db, "settings", "taxonomy"),
                            { genres: newG },
                            { merge: true },
                          );
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newGenreInput.trim()) return;
                    const newG = [...siteGenres, newGenreInput.trim()];
                    setSiteGenres(newG);
                    setDoc(
                      doc(db, "settings", "taxonomy"),
                      { genres: newG },
                      { merge: true },
                    );
                    setNewGenreInput("");
                  }}
                  className="flex gap-2 max-w-sm"
                >
                  <input
                    type="text"
                    value={newGenreInput}
                    onChange={(e) => setNewGenreInput(e.target.value)}
                    placeholder="New Genre (e.g. Space)"
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                  />
                  <button
                    type="submit"
                    className="bg-[var(--color-asura-accent)] px-4 py-2 rounded-lg text-white font-bold text-sm"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div>
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                User Reports
              </h2>
              <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Reason / Context</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {reportsList.map((r) => (
                      <tr key={r.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${r.status === 'pending' ? 'bg-red-500/10' : ''}`}>
                        <td className="py-3 px-4 text-white font-bold uppercase text-[10px] tracking-wider">
                           {r.type.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4">
                           <div className="text-white font-medium break-words break-all max-w-[300px]">{r.reason}</div>
                           {r.type === 'comment' && (
                             <div className="mt-2 pl-2 border-l-2 border-zinc-700 text-zinc-400 italic text-xs break-words break-all max-w-[300px]">
                               "{r.commentContent}"
                             </div>
                           )}
                           {r.type === 'chapter_issue' && (
                             <div className="text-zinc-500 text-xs mt-1">Series: {r.seriesId} | Ch: {r.chapterNumber}</div>
                           )}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 text-xs">
                          {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : 'Just now'}
                        </td>
                        <td className="py-3 px-4">
                           <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded ${r.status === 'pending' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                             {r.status}
                           </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-2">
                             {r.status === 'pending' && (
                               <button onClick={() => setDoc(doc(db, 'reports', r.id), { status: 'resolved' }, { merge: true })} className="text-xs font-bold text-green-400 hover:text-green-300 uppercase tracking-wider text-left">Mark Resolved</button>
                             )}
                             {r.type === 'comment' && (
                               <button onClick={async () => {
                                  if (!window.confirm("Delete this reported comment?")) return;
                                  try {
                                    await import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(doc(db, 'comments', r.commentId)));
                                    await setDoc(doc(db, 'reports', r.id), { status: 'resolved' }, { merge: true });
                                    alert('Comment deleted & Report resolved.');
                                  } catch (e: any) { alert("Error: " + e.message); }
                               }} className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-wider text-left">Delete Comment</button>
                             )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reportsList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500">No reports found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div>
              <h2 className="text-xl font-black text-white uppercase border-b border-white/10 pb-4 mb-4">
                Global Settings
              </h2>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  import('firebase/firestore').then(({ doc, setDoc }) => {
                    setDoc(doc(db, "settings", "global"), siteSettings, { merge: true })
                      .then(() => alert("Settings saved successfully!"))
                      .catch((err: any) => alert("Failed to save settings: " + err.message));
                  });
                }}
                className="space-y-6"
              >
                <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-6">
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={siteSettings.maintenanceMode} 
                        onChange={e => setSiteSettings({...siteSettings, maintenanceMode: e.target.checked})}
                        className="form-checkbox h-5 w-5 text-red-500 bg-black/40 border-white/10 rounded"
                      />
                      <span className="text-white font-bold uppercase tracking-wider text-sm">Maintenance Mode</span>
                    </label>
                    <p className="text-zinc-500 text-xs mt-1 ml-8">When enabled, only administrators can access the site. Normal users will see an "Under Maintenance" page.</p>
                  </div>
                </div>

                <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-2">SEO & Metadata</h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Meta Description</label>
                    <textarea 
                      rows={2} 
                      value={siteSettings.seoDescription} 
                      onChange={e => setSiteSettings({...siteSettings, seoDescription: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Keywords</label>
                    <input 
                      value={siteSettings.seoKeywords} 
                      onChange={e => setSiteSettings({...siteSettings, seoKeywords: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                      placeholder="manga, manhwa, comic"
                    />
                  </div>
                </div>

                <div className="bg-black/20 p-6 rounded-xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-2">Footer Appearance</h3>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">About Us Text</label>
                    <textarea 
                      rows={3} 
                      value={siteSettings.aboutText} 
                      onChange={e => setSiteSettings({...siteSettings, aboutText: e.target.value})} 
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Twitter URL</label>
                      <input 
                        value={siteSettings.twitterUrl} 
                        onChange={e => setSiteSettings({...siteSettings, twitterUrl: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Discord URL</label>
                      <input 
                        value={siteSettings.discordUrl} 
                        onChange={e => setSiteSettings({...siteSettings, discordUrl: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">GitHub URL</label>
                      <input 
                        value={siteSettings.githubUrl} 
                        onChange={e => setSiteSettings({...siteSettings, githubUrl: e.target.value})} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" 
                      />
                    </div>
                  </div>
                </div>
                
                <button type="submit" className="px-8 py-3 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white rounded-lg font-bold uppercase text-sm shadow-lg transition-colors">
                  Save All Settings
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
