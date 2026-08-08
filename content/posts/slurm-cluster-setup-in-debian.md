+++
date = '2026-08-08T00:00:00Z'
title = '🚀 SLURM HPC Cluster Setup on Debian: Complete Guide'
image = 'post13.png'
+++

*Ever wondered how research labs run thousands of jobs at once?* 🤔 Welcome to the world of HPC (High Performance Computing)! In this guide, I'll walk you through building your very own **SLURM cluster** on Debian — from why you'd want one, to the full controller setup, adding compute nodes, and exposing everything through a **REST API** and a **web dashboard**. Let's get computing! 🖥️

![SLURM HPC Cluster Architecture](/images/post13.png)

## What is SLURM? 🤨

**SLURM** (Simple Linux Utility for Resource Management) is the most widely used open-source workload manager in the world of supercomputing. It's installed on the majority of the world's top 500 supercomputers and powers massive research clusters at universities and national labs.

SLURM is essentially a **scheduler + resource manager** that sits on top of a pool of machines (called a cluster) and decides:

- 📋 **Which jobs run when** — you submit a job, SLURM queues it and schedules it.
- 🧮 **What resources each job gets** — CPU cores, memory, GPUs, nodes.
- 👮 **Who gets to use the cluster** — accounts, fair-share policies, priority.
- 📊 **How resources are tracked** — accounting, usage reports, job history.

Your computer becomes the *controller* (the "brain"), and other machines become *compute nodes* (the "muscles") that actually run your jobs.

## Why Use SLURM? 🎯

Why go through the trouble of building a cluster instead of just running jobs with scripts?

- **🔄 Job Queuing** — Users submit jobs and walk away. SLURM runs them when resources free up, no babysitting required.
- **⚖️ Fair Resource Sharing** — Enforce per-user, per-account and per-partition limits with priorities and fair-share scheduling.
- **📦 Dependency Management** — "Run job B only after job A succeeds." SLURM handles chains of dependencies natively.
- **🔁 Backfill Scheduling** — Small jobs squeeze into gaps around big reservations, keeping the cluster 100% busy.
- **🧱 Multi-node Jobs** — Run MPI workloads that span many machines at once with a single `srun` command.
- **🗂️ Accounting** — Track every CPU-hour per user/account for billing or reporting via `slurmdbd` + MariaDB.
- **🔒 Authentication** — Munge shared-secret auth between all machines, plus JWT for the REST API.
- **🛡️ Isolation** — cgroup v2 resource control keeps jobs from stealing CPU/RAM from each other.

## Final Architecture 🏗️

Here's what we're going to build — a cluster named **`build`**:

| Component | Daemon | Port | Role |
|-----------|--------|------|------|
| Controller | `slurmctld` | 6817 | The brain — schedules everything |
| Compute Node #1 | `slurmd` | 6818 | This machine is also node #1 |
| Accounting | `slurmdbd` | 6819 | Job accounting database API |
| Auth | `munged` | 7777 | Munge shared-secret authentication |
| Database | `mariadbd` | 3306 | Stores accounting data |
| REST API | `slurmrestd` | unix socket | REST interface to the cluster |
| Web UI | `slurm-web-gateway` | 5011 | Browser dashboard |
| Web Agent | `slurm-web-agent` | 5012 | Bridge between gateway and slurmrestd |
| Cache | `redis-server` | — | Caches agent queries |

- **Software**: Slurm 26.05.2 (built from source, SchedMD GitHub release)
- **Auth**: Munge (primary) + JWT HS256 (alternate)
- **Accounting**: slurmdbd + MariaDB 11.8 (local)
- **Configless**: compute nodes fetch the config from the controller automatically

---

## 🛠️ Part 1: Controller Setup (Step-by-Step)

### Step 1 — Install Build Dependencies

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
    build-essential autoconf automake bison flex make cmake gcc g++ \
    munge libmunge-dev libssl-dev libncurses-dev libmariadb-dev mariadb-server \
    pkg-config python3 lua5.4 liblua5.4-dev libhwloc-dev libhttp-parser-dev \
    libcurl4-openssl-dev libjwt-gnutls-dev libpam0g-dev libdbus-1-dev \
    libsystemd-dev libjson-c-dev
```

**⚠️ Important package notes:**

- **`libjwt-gnutls-dev`** provides the JWT library Slurm 26.x requires. Debian installs `libjwt-gnutls.so` (no plain `libjwt.so`), so add an aliasing symlink so the build finds `-ljwt`:
  ```bash
  sudo ln -s /usr/lib/x86_64-linux-gnu/libjwt-gnutls.so \
             /usr/lib/x86_64-linux-gnu/libjwt.so
  ```
- **`libdbus-1-dev` + `libsystemd-dev` are REQUIRED** before `./configure`, otherwise the cgroup/v2 plugin is not built and `slurmd` will fail to start.
- `libmariadb-dev` pulls in `/usr/bin/mariadb_config` used for MySQL support.

### Step 2 — Create the `slurm` User and Directories

```bash
sudo useradd -r -M -d /nonexistent -s /bin/false slurm
sudo mkdir -p /etc/slurm /var/spool/slurmctld /var/spool/slurmd \
              /var/log/slurm /var/log/slurm/archive
sudo chown slurm:slurm /var/spool/slurmctld /var/spool/slurmd \
                       /var/log/slurm /var/log/slurm/archive
sudo chmod 0755 /var/spool/slurmctld /var/spool/slurmd
```

### Step 3 — Download and Build Slurm 26.05.2 from Source

```bash
sudo mkdir -p /opt/slurm && cd /opt/slurm
sudo curl -fSL -O https://github.com/SchedMD/slurm/releases/download/\
    slurm-26-05-2-1/slurm-26.05.2.tar.bz2
sudo tar xjf slurm-26.05.2.tar.bz2
cd slurm-26.05.2

./configure \
    --prefix=/usr \
    --sysconfdir=/etc/slurm \
    --libdir=/usr/lib/x86_64-linux-gnu \
    --with-munge=/usr \
    --with-mysql-config=/usr/bin \
    --with-hwloc=/usr \
    --enable-pam \
    --with-pam_dir=/usr/lib/x86_64-linux-gnu/security
make -j$(nproc)
sudo make install
```

**🔧 Configure gotchas** (they cost real time during the build):

- `--with-mysql-config` expects a **DIRECTORY** (e.g. `/usr/bin`), not the binary.
- `--with-lua` only accepts `"yes"`/`"no"`; omit it (or re-add optional liblua).
- After installing libdbus/systemd-dev you **must re-run configure & make**, otherwise the cgroup/v2 plugin stays missing.
- After `make install` the trees are: `/usr/bin|sbin`, `/usr/include/slurm`, `/usr/lib/x86_64-linux-gnu/slurm/` (plugins), `/usr/lib/slurm` etc.

Verify the cgroup_v2 plugin exists after install:

```bash
ls /usr/lib/x86_64-linux-gnu/slurm/ | grep cgroup_v2   # -> cgroup_v2.so
```

### Step 4 — Munge: the Shared Cluster Secret 🔐

Munge is how cluster machines trust each other. Generate the key **once** on the controller:

```bash
sudo dd if=/dev/urandom of=/etc/munge/munge.key bs=1024 count=1
sudo chown munge:munge /etc/munge/munge.key
sudo chmod 400 /etc/munge/munge.key
sudo systemctl enable --now munge
sudo munge -n | unmunge        # print your identity; sanity check
```

**Every machine must have the byte-identical `munge.key`.** Copy it to each node:

```bash
sudo scp /etc/munge/munge.key <node>:/etc/munge/munge.key
```

Verify nodes match:

```bash
sudo sha256sum /etc/munge/munge.key
# -> ff5acab1c4d54d28ea3c409a0424a16d668f8d8522b4b1c7839fbbb32d328429
```

### Step 5 — Configure `slurm.conf`

The heart of the cluster — `/etc/slurm/slurm.conf` (root:root, 0644):

```ini
# /etc/slurm/slurm.conf  (cluster "build", Slurm 26.05.2)
ClusterName=build
SlurmctldHost=build-slurm-as1-01
#SlurmctldHost=second-controller.example.com   # optional second/backup

AuthType=auth/munge
AuthAltTypes=auth/jwt
AuthAltParameters=jwt_key=/var/spool/slurmctld/jwt_hs256.key

SlurmUser=slurm
SlurmctldPort=6817
SlurmdPort=6818

SlurmctldTimeout=300
SlurmdTimeout=300

StateSaveLocation=/var/spool/slurmctld
SlurmdSpoolDir=/var/spool/slurmd
SlurmctldPidFile=/run/slurmctld/slurmctld.pid
SlurmdPidFile=/run/slurmd/slurmd.pid
SlurmctldLogFile=/var/log/slurm/slurmctld.log
SlurmdLogFile=/var/log/slurm/slurmd.log
SlurmctldDebug=info
SlurmdDebug=info
LogTimeFormat=iso8601
SlurmctldParameters=enable_configless            # nodes pull config from ctld

SelectType=select/cons_tres
SelectTypeParameters=CR_Core_Memory
ReturnToService=1

SchedulerType=sched/backfill
MpiDefault=none
ProctrackType=proctrack/cgroup
TaskPlugin=task/cgroup

AccountingStorageType=accounting_storage/slurmdbd
AccountingStorageHost=build-slurm-as1-01
JobAcctGatherType=jobacct_gather/linux
JobAcctGatherFrequency=30

# Node definitions (this controller is also compute node #1):
NodeName=build-slurm-as1-01 CPUs=8 Boards=1 SocketsPerBoard=1 \
        CoresPerSocket=4 ThreadsPerCore=2 RealMemory=7600 State=UNKNOWN

PartitionName=normal Nodes=ALL Default=YES DefaultTime=01:00:00
              MaxTime=INFINITE State=UP
```

*Adjust `NodeName`/`CPUs`/`RealMemory` per host (or use `NodeName=ALL` and let slurmd auto-detect with configless). `RealMemory` is in MiB.*

### Step 6 — cgroup.conf (cgroup v2 Isolation)

`/etc/slurm/cgroup.conf` (root:root, 0644):

```ini
# /etc/slurm/cgroup.conf  (unified cgroup v2)
CgroupPlugin=cgroup/v2            # "cgroup/v2" - NOT "systemd" (renamed in 26.05)
ConstrainCores=yes
ConstrainDevices=yes
ConstrainRAMSpace=yes
ConstrainSwapSpace=yes
```

### Step 7 — Generate the JWT Key (HS256)

```bash
sudo dd if=/dev/urandom of=/var/spool/slurmctld/jwt_hs256.key bs=32 count=1
sudo chown slurm:slurm /var/spool/slurmctld/jwt_hs256.key
sudo chmod 0600 /var/spool/slurmctld/jwt_hs256.key
```

### Step 8 — Set Up MariaDB and the Slurm Database 🗄️

```bash
sudo systemctl enable --now mariadb
PASSWORD=$(openssl rand -hex 16)
sudo mariadb -qe "
    CREATE DATABASE IF NOT EXISTS slurm_acct_db
        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'slurm'@'localhost' IDENTIFIED BY '$PASSWORD';
    CREATE USER IF NOT EXISTS 'slurm'@'127.0.0.1' IDENTIFIED BY '$PASSWORD';
    GRANT ALL PRIVILEGES ON slurm_acct_db.* TO 'slurm'@'localhost';
    GRANT ALL PRIVILEGES ON slurm_acct_db.* TO 'slurm'@'127.0.0.1';
    FLUSH PRIVILEGES;"
sudo systemctl restart mariadb
```

**📝 Optional MariaDB tuning** (stops slurmdbd "recommended values" warnings at first start) — put into `/etc/mysql/mariadb.conf.d/99-slurm.cnf`:

```ini
[mysqld]
innodb_buffer_pool_size = 2G
innodb_log_file_size    = 64M
innodb_lock_wait_timeout = 900
max_allowed_packet      = 128M
transaction-isolation   = READ-COMMITTED
```

### Step 9 — Configure `slurmdbd.conf`

`/etc/slurm/slurmdbd.conf` (slurm:slurm, 0600):

```ini
# /etc/slurm/slurmdbd.conf
AuthType=auth/munge
AuthAltTypes=auth/jwt
AuthAltParameters=jwt_key=/var/spool/slurmctld/jwt_hs256.key

DbdHost=127.0.0.1
DbdPort=6819
SlurmUser=slurm

LogFile=/var/log/slurm/slurmdbd.log
PidFile=/run/slurmdbd/slurmdbd.pid               # inside systemd RuntimeDirectory
DebugLevel=info
ArchiveDir=/var/log/slurm/archive

StorageType=accounting_storage/mysql
StorageHost=localhost
StoragePort=3306
StorageUser=slurm
StoragePass=$PASSWORD                              # must match SQL user
StorageLoc=slurm_acct_db

PurgeJobAfter=1month
PurgeStepAfter=1month
PurgeResvAfter=1month
PurgeEventAfter=1month
```

### Step 10 — Install systemd Units and Start Everything

Slurm ships its own unit files in the source tree:

```bash
sudo cp /opt/slurm/slurm-26.05.2/etc/{slurmctld,slurmd,slurmdbd}.service \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now munge mariadb slurmdbd slurmctld slurmd
# (units may read /etc/default/{slurmctld,slurmd,slurmdbd} for $..._OPTIONS)
```

### Step 11 — First-Run Sanity Checks ✅

```bash
sudo systemctl is-active munge mariadb slurmdbd slurmctld slurmd
sacctmgr show clusters          # cluster "build" auto-registers on first link
sinfo
# expected: one node "build-slurm-as1-01" in state "idle"
```

### Step 12 — End-to-End Job + JWT Test 🧪

```bash
srun hostname                          # interactive job  (uses Munge)
printf '#!/bin/bash\nhostname\n' > /tmp/j.sh && sbatch /tmp/j.sh
sacct                                   # shows COMPLETED with exit code

scontrol token username=$USER | cut -d= -f2   # produce a token
export SLURM_JWT=$(scontrol token username=$USER | cut -d= -f2)
sinfo                                   # works via JWT
unset SLURM_JWT                         # return to Munge
```

---

## 🔗 Part 2: Adding a Compute Node on Another Machine

On each additional machine, repeat these steps as root:

1. **Build/install Slurm identically** (controller STEP 1 + 3). The node does **not** need `slurmdbd` or `slurmctld` installed — only the slurm binaries, configless `slurmd`, munge, and the directories.

2. **Create the daemon user**:
   ```bash
   sudo useradd -r -M -d /nonexistent -s /bin/false slurm
   ```

3. **Munge** — copy the SAME key from the controller and start:
   ```bash
   sudo scp controller:/etc/munge/munge.key /etc/munge/munge.key
   sudo chown munge:munge /etc/munge/munge.key
   sudo chmod 400 /etc/munge/munge.key
   sudo systemctl enable --now munge
   sudo munge -n | unmunge
   ```

4. **Configless slurmd** — point it at the controller and start:
   ```bash
   sudo bash -c 'echo "SLURMD_OPTIONS=\"--conf-server=<controller_hostname>\"" \
                 > /etc/default/slurmd'
   sudo systemctl enable --now slurmd
   ```
   The slurmd fetches `/etc/slurm/slurm.conf` from the controller and must know its hostname (also matching a `NodeName` if you defined one statically).

5. **On the CONTROLLER**, after the node comes up:
   - If you use explicit node definitions, append a `NodeName` line to `/etc/slurm/slurm.conf` for the new node and run:
     ```bash
     sudo scontrol reconfigure
     ```
   - With configless + `NodeName` auto-detect/ALL, the node registers itself by its hostname. See it with: `sinfo --all`

6. **Classic (no configless) alternative**: copy `/etc/slurm/slurm.conf` to `/etc/slurm/slurm.conf` on each node, keep munge, and run:
   ```bash
   sudo systemctl enable --now slurmd
   ```

7. **Check from the controller**:
   ```bash
   sinfo
   srun --exclusive hostname -a
   ```

---

## 🎛️ Part 3: Everyday SLURM Command Examples

Once your cluster is up, these are the commands you'll use every day.

### Cluster Status 📊

```bash
sinfo                          # partition/node state overview
sinfo -N -o "%N %t %C %m"      # one line per node: name, state, CPUs, memory
scontrol show nodes            # detailed node config & state
scontrol show partition        # partition settings
scontrol show job 12345        # details of a specific job
squeue                         # list all queued/running jobs
squeue -u $USER                # just your jobs
squeue -p normal               # jobs in the "normal" partition
squeue --states=PENDING,RUNNING
```

### Submitting Jobs 📝

```bash
sbatch myjob.sh                            # submit a batch script
sbatch -N 2 --ntasks-per-node=4 job.sh     # 2 nodes, 4 tasks each
sbatch --time=02:00:00 --mem=4G -p normal script.sh
sbatch --dependency=afterok:12345 next.sh  # run only after job 12345 succeeds
```

Example batch script (`hello.sh`):

```bash
#!/bin/bash
#SBATCH --job-name=hello
#SBATCH --output=hello_%j.out
#SBATCH --error=hello_%j.err
#SBATCH --time=01:00:00
#SBATCH --nodes=1
#SBATCH --ntasks=4
#SBATCH --partition=normal
hostname
srun echo "Hello from SLURM"
```

```bash
sbatch hello.sh        # submit it
squeue -u $USER        # watch it
cat hello_<jobid>.out  # check the output
```

### Interactive Work 🖥️

```bash
srun hostname                  # run a command through the scheduler
srun -N 1 -c 4 --mem=4G bash   # open an interactive shell on a compute node
salloc -N 1 --time=00:30:00    # allocate resources, then run jobs interactively
sattach 12345.0                # attach to the I/O of a running job
```

### Job Control 🎮

```bash
scancel 12345                   # cancel a job
scancel -u $USER                # cancel all your jobs
scancel --state=PENDING         # cancel all pending jobs
scontrol hold 12345             # put a job on hold
scontrol release 12345          # release a held job
scontrol update job 12345 --timelimit=02:00:00   # extend wall time
scontrol reconfigure            # reload slurm.conf on the controller
```

### Accounting Commands (slurmdbd) 💰

```bash
# View job accounting:
sacct                          # job accounting records
sacct -j 12345                 # steps/accounting for one job
sacct --starttime=2026-08-01   # jobs since a date
sacct --format=JobID,JobName,State,Elapsed,ExitCode,User

# Cluster-wide usage reports:
sreport cluster utilization    # per-cluster usage summary
sreport user top               # top users by CPU time

# Manage accounts, users and associations:
sacctmgr show clusters          # clusters registered with slurmdbd
sacctmgr show accounts          # list accounts
sacctmgr show assoc             # associations (account + user + partition)
sacctmgr show user              # list users
sacctmgr add account research   # create an account
sacctmgr add user alice account=research    # add a user to an account
sacctmgr modify user alice set maxjobs=50   # enforce limits
```

---

## 🔥 Part 4: Firewall Ports to Open

If you have a firewall between nodes, open:

| Port | Protocol | Service |
|------|----------|---------|
| 6817/tcp | TCP | slurmctld |
| 6818/tcp | TCP | slurmd |
| 6819/tcp | TCP | slurmdbd |
| 3306/tcp | TCP | ONLY if MariaDB is remote (here it is local) |
| 7777/tcp+udp | TCP+UDP | munged (Munge auth) |
| 5011/tcp | TCP | Slurm-web gateway (web UI) |
| 5012/tcp | TCP | Slurm-web agent (loopback only) |
| 6820/tcp | TCP | slurmrestd ONLY if you use a TCP listener (here: unix socket) |

---

## 🚨 Notes / Caveats

- **JWT + interactive (`srun`/`salloc`): NOT supported** (per Slurm docs) — use the REST API (slurmrestd) or Munge for interactive/write paths.
- The **`slurm` UID (999) should be identical across the cluster**, especially if your spool/home is on shared NFS.
- **Configless nodes do not need `/etc/slurm/slurm.conf` locally** — leave it out or keep it removed.
- **Backup controller**: add a second `SlurmctldHost` line + shared StateSave (NFS) + shared munge key + shared JWT key.
- Logs: `/var/log/slurm/*.log`; per-unit journal: `journalctl -u slurmctld -u slurmd`.

---

## 🌐 Part 5: slurmrestd — the REST API

`slurmrestd` exposes the whole cluster through a RESTful HTTP API (OpenAPI v0.0.45), so you can build tools, scripts and dashboards in any language.

### 5.1 Install and Configure

```bash
# 1. system user (Slurm's own unit file uses User=slurmrestd)
sudo useradd -r -M -d /nonexistent -s /bin/false slurmrestd

# 2. unit file (shipped in the Slurm source tree)
sudo cp /opt/slurm/slurm-26.05.2/etc/slurmrestd.service /etc/systemd/system/

# 3. drop-in: listen on a unix socket with JWT auth
sudo mkdir -p /etc/systemd/system/slurmrestd.service.d
sudo tee /etc/systemd/system/slurmrestd.service.d/slurm-web.conf > /dev/null <<'EOF'
[Service]
# Unset vendor unit ExecStart and Environment to avoid cumulative definition
ExecStart=
Environment=
Environment="SLURM_JWT=daemon"
ExecStart=/usr/sbin/slurmrestd $SLURMRESTD_OPTIONS -a rest_auth/jwt unix:/run/slurmrestd/slurmrestd.socket
RuntimeDirectory=slurmrestd
RuntimeDirectoryMode=0755
User=slurmrestd
Group=slurmrestd
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now slurmrestd
```

### 5.2 Smoke Test with a JWT 🧪

```bash
# the token is printed as one "SLURM_JWT=..." line
export $(scontrol token)
curl -H "X-SLURM-USER-TOKEN:$SLURM_JWT" \
     --unix-socket /run/slurmrestd/slurmrestd.socket \
     http://localhost/slurm/v0.0.45/diag
# => {"meta":{"plugin":{...,"accounting_storage":"accounting_storage/slurmdbd"}...}}
```

### 5.3 REST API Command Examples 🌐

`slurmrestd` gives you a full REST interface — here are the most useful `curl` calls. All of them go through the unix socket with a JWT:

```bash
export SLURM_JWT=$(scontrol token username=$USER | cut -d= -f2)
U=http://localhost/slurm/v0.0.45
S="--unix-socket /run/slurmrestd/slurmrestd.socket"
H="X-SLURM-USER-TOKEN:$SLURM_JWT"

# cluster diagnostics / server info
curl -s -H "$H" $S $U/diag

# list all nodes and their state
curl -s -H "$H" $S $U/nodes

# show partitions
curl -s -H "$H" $S $U/partitions

# list all jobs (running + queued)
curl -s -H "$H" $S $U/jobs

# get one job's details (replace <job_id>)
curl -s -H "$H" $S $U/jobs/<job_id>

# submit a batch job via POST (write action -> needs JWT)
curl -s -X POST -H "$H" -H "Content-Type: application/json" \
     --data '{"job":{"name":"rest-job","nodes":1,"tasks":1,
                     "time_limit":60,"script":"#!/bin/bash\nhostname"}}' \
     $S $U/jobs

# cancel a job (write action)
curl -s -X DELETE -H "$H" $S $U/jobs/<job_id>

# pretty-print any response
curl -s -H "$H" $S $U/diag | python3 -m json.tool
```

**🗒️ Tip:** every endpoint takes `query parameters` too — for example
`curl -s -H "$H" $S "$U/jobs?limit=10"` or `"$U/nodes?state=idle"`.
You can also use the `-sS` flag to see curl errors, or add `-o resp.json` to save a response.

---

## 🖥️ Part 6: slurm-web — Web Dashboard for Your Cluster

**Slurm-web** (Rackslab v7) gives you a beautiful browser-based dashboard on top of the REST API. It has two parts:

- **`slurm-web-gateway`** — the web UI you open in your browser (listens on `0.0.0.0:5011`).
- **`slurm-web-agent`** — talks to slurmrestd and caches results (listens on `127.0.0.1:5012`).

### 6.1 Add the Rackslab Repository

```bash
sudo apt-get install -y gnupg
curl -sS https://pkgs.rackslab.io/keyring.asc | gpg --dearmor \
    | sudo tee /usr/share/keyrings/rackslab.gpg > /dev/null
sudo tee /etc/apt/sources.list.d/rackslab.sources > /dev/null <<'EOF'
Types: deb
URIs: https://pkgs.rackslab.io/deb
Suites: trixie
Components: main slurmweb-7
Architectures: amd64
Signed-By: /usr/share/keyrings/rackslab.gpg
EOF
sudo apt-get update
```

### 6.2 Install Agent + Gateway

```bash
# NOTE: does NOT pull Debian's own slurm/slurmrestd; "slurmrestd" is only a
# Suggests. Our source build is left untouched.
sudo apt-get install -y slurm-web-agent slurm-web-gateway
```

### 6.3 Configure Agent and Gateway

```bash
sudo tee /etc/slurm-web/agent.ini > /dev/null <<'EOF'
[service]
cluster=build

[cache]
enabled=yes
EOF

sudo tee /etc/slurm-web/gateway.ini > /dev/null <<'EOF'
[service]
interface=0.0.0.0

[agents]
url=http://localhost:5012
EOF
```

*`interface=0.0.0.0` exposes the UI on TCP/5011 to the network. In production put Nginx/Caddy with TLS in front — see Rackslab WSGI docs.*

### 6.4 Generate Secrets and Share the JWT Key

```bash
# Slurm-web secret keys (run as root):
sudo slurm-web gen-session-key --set-ownership   # /var/lib/slurm-web/session.key
sudo slurm-web gen-jwt-key --set-ownership       # /var/lib/slurm-web/jwt.key

# Share the Slurm JWT signing key with the agent so it can talk to slurmrestd
# (same bytes as /var/spool/slurmctld/jwt_hs256.key):
sudo cp /var/spool/slurmctld/jwt_hs256.key /var/lib/slurm-web/slurmrestd.key
sudo chown slurm-web:slurm-web /var/lib/slurm-web/slurmrestd.key
sudo chmod 400 /var/lib/slurm-web/slurmrestd.key
```

> 🔒 **Security note:** the agent keeps a copy of the Slurm JWT key at `/var/lib/slurm-web/slurmrestd.key` with 0400 perms — treat it like the munge key. Never share it over insecure channels.

### 6.5 Add Redis Cache (Recommended)

```bash
sudo apt-get install -y redis-server && sudo systemctl enable --now redis
```

### 6.6 Start Everything and Verify

```bash
sudo systemctl enable --now slurm-web-agent.service slurm-web-gateway.service

# Health checks
sudo -u slurm-web /usr/bin/slurm-web connect-check
#   => connection successful! (cluster: build, slurm: 26.05.2, api: 0.0.45)

curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5011/        # 200

# Data roundtrip through gateway -> agent -> slurmrestd (anonymous token):
TOKEN=$(curl -s http://127.0.0.1:5011/api/anonymous | python3 -c \
    "import sys,json;print(json.load(sys.stdin)['token'])")
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5011/api/agents/build/nodes
```

### 6.7 Open the Dashboard 🌐

Open `http://<controller-IP>:5011/` in your browser.

Default policy is **anonymous view**; admin/action roles need auth or a custom `policy.ini` — see Rackslab docs on LDAP/OIDC + WSGI for production.

---

## 💭 Final Thoughts

You've now built a complete HPC cluster on Debian:

1. ✅ **Controller** with `slurmctld`, `slurmd`, `slurmdbd`, Munge + MariaDB
2. ✅ **Configless compute nodes** that join the cluster with one systemd service
3. ✅ **REST API** via `slurmrestd` with JWT auth
4. ✅ **Web dashboard** via Slurm-web, powered by Redis caching

From a single `sbatch` submission to a full web dashboard showing cluster status, your job scheduling needs are covered — just like the big supercomputers. 🦾

**Challenge for you:** try adding a second compute node and running an MPI job across both! 

---

💬 **Let me know in the comments:** What workloads are you planning to run on your SLURM cluster? Struggling with any part of the setup? I'd love to help!

🔗 *Share this guide with your fellow HPC enthusiasts!*
