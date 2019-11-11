import sys
from application import *
import numpy as np
import seaborn as sns
import pandas as pd
import matplotlib.pyplot as plt


# Check if a directory exists, if not, create it
def check_and_create_dir(path):
    if path is None: return
    dir_name = os.path.dirname(path)
    if dir_name != "" and not os.path.exists(dir_name):
        try: # this is used to prevent race conditions during parallel computing
            os.makedirs(dir_name)
        except Exception as ex:
            print(ex)


def analyze_user():
    p = "../data/analysis/"
    check_and_create_dir(p)

    users = User.query.all()
    num_users = 0 # total number of users
    num_player = 0 # reviewed at least one batch but none of them passed quality check
    num_explorer = 0 # contributed at least one batch
    num_batches = 0 # number of good batches (passed quality check)
    num_all_batches = 0 # number of reviewed batches
    df_q = {"reliability": [], "num_batches": [], "num_all_batches": []}
    for u in users:
        if u.id == 1:
            print("="*60)
            print("Researcher labeled %d batches" % (u.raw_score/12))
            continue # need to exclude the researcher
        if u.client_id == "{}": continue # bad data
        num_users += 1
        if u.raw_score > 0:
            nb_all = u.raw_score/12
            num_all_batches += nb_all
            if u.score == 0:
                num_player += 1
            elif u.score > 0:
                num_explorer += 1
                df_q["reliability"].append(np.round(u.score/u.raw_score, 2))
                nb = u.score/12
                df_q["num_batches"].append(nb)
                num_batches += nb
                df_q["num_all_batches"].append(nb_all)
    df_q = pd.DataFrame.from_dict(df_q)
    df_q.name = "users contributed at least one batch"
    mean_num_batches = np.round(df_q["num_batches"].mean())
    print("Average number of contributed batches: %d" % mean_num_batches)
    hq_enthusiasts = df_q[(df_q["reliability"]>=0.5) & (df_q["num_batches"]>=mean_num_batches)]
    hq_enthusiasts.name = "hq_enthusiasts"
    lq_enthusiasts = df_q[(df_q["reliability"]<0.5) & (df_q["num_batches"]>=mean_num_batches)]
    lq_enthusiasts.name = "lq_enthusiasts"
    hq_explorers = df_q[(df_q["reliability"]>=0.5) & (df_q["num_batches"]<mean_num_batches)]
    hq_explorers.name = "hq_explorers"
    lq_explorers = df_q[(df_q["reliability"]<0.5) & (df_q["num_batches"]<mean_num_batches)]
    lq_explorers.name = "lq_explorers"
    print("="*60)
    print("# of total users: %d" % num_users)
    print("# of users reviewed at least one batch but no contribution: %d(%.2f)" % (num_player, num_player/num_users))
    print("# of users contributed at least one batch: %d(%.2f)" % (num_explorer, num_explorer/num_users))
    print("="*60)
    print("# of total reviewed batches: %d" % num_all_batches)
    print("# of total good batches: %d" % num_batches)
    print("collaborative reliability: %.2f" % (num_batches/num_all_batches))
    describe_user_grp(df_q, num_users, num_batches, num_all_batches)
    describe_user_grp(hq_enthusiasts, num_users, num_batches, num_all_batches)
    describe_user_grp(lq_enthusiasts, num_users, num_batches, num_all_batches)
    describe_user_grp(hq_explorers, num_users, num_batches, num_all_batches)
    describe_user_grp(lq_explorers, num_users, num_batches, num_all_batches)

    """
    g = sns.JointGrid(x="num_batches", y="reliability", data=df_q, height=5)
    #g.plot_joint(sns.scatterplot, alpha=0.4, s=40)
    g.plot_joint(plt.hexbin, cmap="Blues", xscale="log", gridsize=(10, 8), vmin=0, vmax=5)
    g.set_axis_labels("# of contributed batches", "reliability", fontsize=12)
    g.ax_joint.set(xscale="log")
    g.ax_marg_x.hist(x=df_q["num_batches"], bins=[10**(i*0.5) for i in range(7)], log=True, alpha=0.5)
    g.ax_marg_y.hist(x=df_q["reliability"], bins=[0.1*i for i in range(11) if i > 0], alpha=0.5, orientation="horizontal")
    g.savefig(p+"user_quality.png", dpi=150)
    plt.close()
    """


def describe_user_grp(df, num_users, num_batches, num_all_batches):
    print("="*60)
    print("# of %s: %d(%.2f)" % (df.name, len(df), len(df)/num_users))
    nb = df["num_batches"].sum()
    nb_all = df["num_all_batches"].sum()
    print("# of contributed batches (%s): %d (%.2f)" % (df.name, nb, nb/num_batches))
    print("# of reviewed batches (%s): %d (%.2f)" % (df.name, nb_all, nb_all/num_all_batches))
    print("# group reliability (%s): %.2f" % (df.name, nb/nb_all))
    print(df.describe().round(2))


def aggregate_label(row):
    label_state_admin = row["label_state_admin"]
    label_state = row["label_state"]
    label = None
    has_error = False
    if label_state_admin == 47: # pos (gold standard)
        label = 1
    elif label_state_admin == 32: # neg (gold standard)
        label = 0
    elif label_state_admin == 23: # strong pos
        label = 1
    elif label_state_admin == 16: # strong neg
        label = 0
    else: # not determined by researchers
        if label_state == 23: # strong pos
            label = 1
        elif label_state == 16: # strong neg
            label = 0
        elif label_state == 20: # weak neg
            label = 0
        elif label_state == 19: # weak pos
            label = 1
        else:
            has_error = True
    if has_error:
        print("Error when aggregating label:")
        print(row)
    return label


def analyze_data():
    pos_labels = [0b10111, 0b1111, 0b10011]
    neg_labels = [0b10000, 0b1100, 0b10100]
    pos_gold_labels = [0b101111]
    neg_gold_labels = [0b100000]
    maybe_pos_labels = [0b101]
    maybe_neg_labels = [0b100]
    discorded_labels = [0b11]
    bad_labels = [-2]
    full = pos_labels + neg_labels
    gold = pos_gold_labels + neg_gold_labels

    # Select fully labeled videos
    v = Video.query.filter(and_(
        Video.label_state_admin.notin_(bad_labels + gold),
        or_(
            Video.label_state_admin.in_(full),
            Video.label_state.in_(full))
        )).all()
    v_json = videos_schema_is_admin.dump(v)
    df_v = pd.DataFrame.from_dict(v_json)
    print("Number of videos: %d" % len(df_v))

    # Add aggregated labels
    df_v["label"] = df_v.apply(aggregate_label, axis=1)
    print(df_v)

    # Groups
    gp_v = df_v.groupby(["camera_id", "view_id"])
    for name, group in gp_v:
        print(name)
        print(group)
    print(gp_v.groups.keys())


def main(argv):
    analyze_user()
    #analyze_data()


if __name__ == "__main__":
    main(sys.argv)
