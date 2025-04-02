+++
date = '2025-04-02T03:25:58Z'
title = 'Mastering GitHub CLI on Termux: A Complete Guide 🚀'
image='post9.jpg'
+++


GitHub CLI (`gh`) is a powerful command-line tool that lets you interact with GitHub directly from your terminal. In this guide, we'll explore how to install, configure, and use `gh` on **Termux** (Android's terminal emulator) like a pro! 🔥  

---

## 📥 **Installation**  

First, ensure your Termux is up-to-date:  
```bash
pkg update && pkg upgrade -y
```  

Install GitHub CLI with just one command:  
```bash
pkg install gh -y
```  

Verify installation:  
```bash
gh --version
```  

✅ Done! You now have `gh` installed.  

---

## 🔐 **Authentication**  

To use `gh`, you need to log in to your GitHub account:  
```bash
gh auth login
```  

Follow the prompts:  
- Choose `GitHub.com` (default).  
- Select `HTTPS` for authentication.  
- Login via browser (copy-paste the one-time code).  

🎉 You're now authenticated!  

---

## 🛠 **Basic Commands**  

### 🔍 **View Profile & Repos**  
```bash
gh api user
gh repo list
```  

### 📂 **Clone a Repository**  
```bash
gh repo clone <username>/<repo>
```  

### ➕ **Create a New Repo**  
```bash
gh repo create <repo-name> --public --clone
```  

### ❌ **Delete a Repository**  
```bash
gh repo delete <repo-name> --confirm
```  
⚠️ **Warning:** This permanently deletes the repository! Use with caution.

### 🔄 **Push Changes**  
```bash
git add .
git commit -m "Your message"
gh pr create
```  

### 🏷 **Manage Pull Requests**  
```bash
gh pr list
gh pr checkout <PR-number>
gh pr merge <PR-number>
```  

### 🏷 **Work with Issues**  
```bash
gh issue list
gh issue create --title "Bug fix" --body "Description"
gh issue close <issue-number>
```  

---

## 🚀 **Advanced Usage**  

### 🔄 **GitHub Actions**  
```bash
gh workflow list
gh run watch
```  

### 🔎 **Search Repos & Code**  
```bash
gh search repos "termux"
gh search code "github cli"
```  

### 📦 **Gists (Pastebin Alternative)**  
```bash
gh gist create myfile.txt --public
gh gist list
```  

---

## 💡 **Pro Tips**  

- Use `gh alias` to create shortcuts for frequent commands.  
- Enable **autocomplete** for `gh` in Termux:  
  ```bash
  gh completion -s bash >> ~/.bashrc
  source ~/.bashrc
  ```  
- Check `gh help` for more commands.  

---

## ❓ **Troubleshooting**  

### ❌ **"gh: command not found"**  
Reinstall `gh`:  
```bash
pkg install gh -y
```  

### 🔑 **Authentication Issues**  
Log out and log back in:  
```bash
gh auth logout
gh auth login
```  

---

## 🎯 **Conclusion**  

GitHub CLI (`gh`) makes GitHub workflows seamless, even on **Termux**! Whether you're managing repos, PRs, or issues, `gh` has you covered. 🚀  

📢 **Now go automate your GitHub workflow like a boss!** 💪  

🔗 **Official Docs:** [GitHub CLI Documentation](https://cli.github.com/)  

---

📌 **Tags:**  
`#GitHub` `#Termux` `#CLI` `#DevOps` `#Automation` 
