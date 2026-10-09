#!/bin/sh
# Gives a small server (1 GB of RAM) a 2 GB swap file, switched on now and after every reboot, and a low
# vm.swappiness, so a short memory peak slows the site down for a moment instead of the kernel killing a store.
# The low-memory mode needs it. Run it once on the server: sudo ./scripts/swap.sh   (safe to run again: it only
# adds what is missing)
#   SWAP_SIZE=4G sudo ./scripts/swap.sh   # another size
# This work made by Anfinogentov Nikita
set -e
size=${SWAP_SIZE:-2G}
file=${SWAP_FILE:-/swapfile}
swappiness=10
count=${size%G}

case "$size" in
  [1-9]G | [1-9][0-9]G) ;;
  *) echo "Ooops.. SWAP_SIZE is a whole number of gigabytes, like 2G"; exit 1 ;;
esac
if [ "$(id -u)" -ne 0 ]; then
  echo "Ooops.. run it as root: sudo ./scripts/swap.sh"
  exit 1
fi

in_container() {
  # OpenVZ and LXC "VPSes" share the provider's kernel, which never lets them switch swap on
  case "$(systemd-detect-virt --container 2>/dev/null || true)" in
    openvz | lxc | lxc-libvirt) return 0 ;;
  esac
  [ -e /proc/user_beancounters ]
}

write_file() {
  # btrfs only takes a swap file without copy-on-write, set while the file is still empty
  if [ "$(stat -f -c %T "$(dirname "$file")")" = btrfs ]; then
    truncate -s 0 "$file"
    chattr +C "$file"
  fi
  # There I fall back to dd: fallocate makes files that swapon refuses on some filesystems (older XFS)
  if [ "$1" = dd ] || ! fallocate -l "$size" "$file" 2>/dev/null; then
    dd if=/dev/zero of="$file" bs=1M count=$((count * 1024)) status=none
  fi
  chmod 600 "$file"
  mkswap "$file" >/dev/null
}

# 1. the swap itself: only when the machine has none at all (a provider's swap partition counts too)
if [ -n "$(swapon --noheadings --show=NAME 2>/dev/null)" ] || [ "$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)" -gt 0 ]; then
  echo "swap: already on, nothing to add"
  swapon --show 2>/dev/null || true
else
  if in_container; then
    echo "Ooops.. this server is a container (OpenVZ or LXC), where only the provider can add swap."
    echo "Ask the provider for swap, or pick a KVM server; the low-memory mode needs it."
    exit 1
  fi
  created=no
  if [ -e "$file" ]; then
    # There I only reuse a file that already is a swap file, and never delete one I did not make
    if [ "$(blkid -o value -s TYPE "$file" 2>/dev/null || true)" != swap ]; then
      echo "Ooops.. $file exists and is not a swap file; move it away or pick another name: SWAP_FILE=/swapfile2"
      exit 1
    fi
  else
    need=$((count * 1024 * 1024 + 512 * 1024))
    free=$(df -Pk "$(dirname "$file")" | awk 'NR == 2 {print $4}')
    if [ "$free" -lt "$need" ]; then
      echo "Ooops.. $(dirname "$file") has $((free / 1024)) MB free, a $size swap file needs $((need / 1024)) MB (with a margin)"
      exit 1
    fi
    echo "swap: making $file ($size)"
    created=yes
    write_file
  fi
  if ! swapon "$file" 2>/dev/null; then
    if [ "$created" = no ]; then
      echo "Ooops.. swapon refused $file:"
      swapon "$file" || true
      exit 1
    fi
    # a fallocate file can be refused: write it out for real once
    echo "swap: swapon refused the file, writing it out with dd"
    rm -f "$file"
    write_file dd
    if ! swapon "$file"; then
      rm -f "$file"
      echo "Ooops.. the kernel refused the swap file (removed it again); ask the provider about swap"
      exit 1
    fi
  fi
  echo "swap: on"
  swapon --show
fi

# 2. after a reboot: an /etc/fstab line, added once
if [ "$(blkid -o value -s TYPE "$file" 2>/dev/null || true)" = swap ] && ! grep -qE "^[[:space:]]*${file}[[:space:]]" /etc/fstab; then
  echo "$file none swap sw 0 0" >> /etc/fstab
  echo "swap: added $file to /etc/fstab"
fi

# 3. use the swap only under real pressure (the default 60 pushes the stores out too eagerly)
sysctl -q -w vm.swappiness=$swappiness
echo "vm.swappiness = $swappiness" > /etc/sysctl.d/99-modernsi-swap.conf
echo "swap: vm.swappiness=$swappiness (kept in /etc/sysctl.d/99-modernsi-swap.conf)"
free -m
